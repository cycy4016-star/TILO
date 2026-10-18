// Operator activity alerts. Server-only. Two halves:
//
//   1. captureAdminAlert() — called next to the write that made the activity
//      (a signup, an order, a payment…) and never allowed to break it. It reads
//      every admin's setting for that kind and either fires an alert row
//      immediately (cadence INSTANT) or stacks one lightweight event row for
//      the digest flush (HOURLY/DAILY).
//   2. flushDueAdminAlerts() — materialises every digest window that has fully
//      closed into one alert per admin ("5 new orders · 14:00–15:00"). Runs on
//      the alerts feed poll, so it needs no cron; digestKey makes it idempotent
//      across concurrent pollers.
//
// A missing setting row means INSTANT — the operator opted into nothing, so
// they get told about everything until they tune it down.
import 'server-only';

import type { AdminAlertCadence, AdminAlertKind } from '@prisma/client';
import { prisma } from '@/lib/db';

export const ADMIN_ALERT_KINDS = [
  'SIGNUP',
  'STORE',
  'ORDER',
  'PAYMENT',
  'INCIDENT',
  'FEEDBACK',
] as const satisfies readonly AdminAlertKind[];

export const ADMIN_ALERT_CADENCES = [
  'OFF',
  'INSTANT',
  'HOURLY',
  'DAILY',
] as const satisfies readonly AdminAlertCadence[];

/** Human labels for digest headlines and the rules editor. */
export const KIND_LABELS: Record<AdminAlertKind, string> = {
  SIGNUP: 'new signups',
  STORE: 'new shops',
  ORDER: 'new orders',
  PAYMENT: 'payments',
  INCIDENT: 'new incidents',
  FEEDBACK: 'feedback',
};

const KIND_LABELS_ONE: Record<AdminAlertKind, string> = {
  SIGNUP: 'new signup',
  STORE: 'new shop',
  ORDER: 'new order',
  PAYMENT: 'payment',
  INCIDENT: 'new incident',
  FEEDBACK: 'feedback note',
};

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const DEFAULT_CADENCE: AdminAlertCadence = 'INSTANT';
const EVENT_RETENTION_MS = 30 * DAY_MS;
const ALERT_RETENTION_MS = 90 * DAY_MS;
const MAX_ALERTS_PER_FLUSH = 40;
const MAX_EVENTS_PER_FLUSH = 400;
const BODY_LIMIT = 400;
/** Polls are chatty; digest materialisation only needs to run occasionally. */
const FLUSH_THROTTLE_MS = 10_000;
let lastFlushAt = 0;

export type AdminAlertInput = {
  kind: AdminAlertKind;
  title: string;
  body?: string | null;
  amountPesewas?: number | null;
  refType?: string | null;
  refId?: string | null;
};

/** Floor a moment to the start of its digest window (UTC buckets). */
export function digestWindowStart(cadence: AdminAlertCadence, at: Date): number {
  const width = cadence === 'DAILY' ? DAY_MS : HOUR_MS;
  return Math.floor(at.getTime() / width) * width;
}

function clipBody(value: string): string {
  return value.length > BODY_LIMIT ? `${value.slice(0, BODY_LIMIT - 1)}…` : value;
}

type EffectiveSetting = { cadence: AdminAlertCadence; minAmountPesewas: number | null };

// Captures fire on hot paths (every order, every first-sighting error), so the
// (tiny) admin + settings lookup is cached in-process for a moment. 30s of
// staleness is invisible at human scale; the settings route invalidates it.
const SETTINGS_TTL_MS = 30_000;
type AdminSettingsSnapshot = {
  at: number;
  admins: string[];
  rows: {
    userId: string;
    kind: AdminAlertKind;
    cadence: AdminAlertCadence;
    minAmountPesewas: number | null;
  }[];
};
let settingsCache: AdminSettingsSnapshot | null = null;

/** Drop the capture cache — called after a settings write and by tests. */
export function invalidateAdminAlertCache(): void {
  settingsCache = null;
}

async function loadAdminSettings(): Promise<{
  admins: string[];
  cadenceFor: (userId: string, kind: AdminAlertKind) => EffectiveSetting;
}> {
  const now = Date.now();
  if (!settingsCache || now - settingsCache.at > SETTINGS_TTL_MS) {
    const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
    const ids = admins.map((admin) => admin.id);
    const rows = ids.length
      ? await prisma.adminAlertSetting.findMany({
          where: { userId: { in: ids } },
          select: { userId: true, kind: true, cadence: true, minAmountPesewas: true },
        })
      : [];
    settingsCache = { at: now, admins: ids, rows };
  }
  const snapshot = settingsCache;
  return {
    admins: snapshot.admins,
    cadenceFor(userId, kind) {
      const row = snapshot.rows.find((r) => r.userId === userId && r.kind === kind);
      return {
        cadence: row?.cadence ?? DEFAULT_CADENCE,
        minAmountPesewas: row?.minAmountPesewas ?? null,
      };
    },
  };
}

/**
 * Record one piece of platform activity. Never throws — a failed alert must
 * not break the signup/order/payment that caused it.
 */
export async function captureAdminAlert(input: AdminAlertInput): Promise<void> {
  try {
    const { admins, cadenceFor } = await loadAdminSettings();
    if (admins.length === 0) return;

    const instantFor: string[] = [];
    const deferredFor: string[] = [];
    for (const userId of admins) {
      const { cadence, minAmountPesewas } = cadenceFor(userId, input.kind);
      if (cadence === 'OFF') continue;
      if (
        minAmountPesewas != null &&
        input.amountPesewas != null &&
        input.amountPesewas < minAmountPesewas
      ) {
        continue;
      }
      if (cadence === 'INSTANT') instantFor.push(userId);
      else deferredFor.push(userId);
    }
    if (instantFor.length === 0 && deferredFor.length === 0) return;

    if (instantFor.length > 0) {
      await prisma.adminAlert.createMany({
        data: instantFor.map((userId) => ({
          userId,
          kind: input.kind,
          title: input.title,
          body: input.body ?? null,
          amountPesewas: input.amountPesewas ?? null,
          refType: input.refType ?? null,
          refId: input.refId ?? null,
        })),
      });
    }
    if (deferredFor.length > 0) {
      await prisma.adminAlertEvent.createMany({
        data: deferredFor.map((userId) => ({
          userId,
          kind: input.kind,
          title: input.title,
          body: input.body ?? null,
          amountPesewas: input.amountPesewas ?? null,
          refType: input.refType ?? null,
          refId: input.refId ?? null,
        })),
      });
    }
  } catch {
    // Alerts are best-effort by design.
  }
}

/** Roll every unflushed event in one closed window into a digest alert. */
function digestAlertFor(input: {
  userId: string;
  kind: AdminAlertKind;
  cadence: AdminAlertCadence;
  windowStart: number;
  events: { title: string; amountPesewas: number | null }[];
}) {
  const hours = input.cadence === 'HOURLY' ? 'hour' : 'day';
  const count = input.events.length;
  const headline = `${count} ${count === 1 ? KIND_LABELS_ONE[input.kind] : KIND_LABELS[input.kind]}`;
  const preview = input.events
    .slice(0, 4)
    .map((event) => event.title)
    .join(' · ');
  const more = count > 4 ? ` · +${count - 4} more` : '';
  const sums = input.events
    .map((event) => event.amountPesewas)
    .filter((v): v is number => v != null);
  return {
    digestKey: `${input.userId}:${input.kind}:${input.cadence}:${input.windowStart}`,
    userId: input.userId,
    kind: input.kind,
    title: `${headline} · last ${hours}`,
    body: clipBody(`${preview}${more}`),
    amountPesewas: sums.length ? sums.reduce((a, b) => a + b, 0) : null,
    count,
    windowStart: new Date(input.windowStart),
    windowEnd: new Date(input.windowStart + (input.cadence === 'DAILY' ? DAY_MS : HOUR_MS)),
    createdAt: new Date(input.windowStart + (input.cadence === 'DAILY' ? DAY_MS : HOUR_MS)),
  };
}

/**
 * Materialise every digest window that has fully closed since the last run.
 * Idempotent: digestKey is unique, so racing pollers cannot double-create.
 */
export async function flushDueAdminAlerts(options?: {
  now?: Date;
  force?: boolean;
}): Promise<{ created: number }> {
  const now = options?.now ?? new Date();
  if (!options?.force && now.getTime() - lastFlushAt < FLUSH_THROTTLE_MS) {
    return { created: 0 };
  }
  lastFlushAt = now.getTime();
  try {
    const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
    if (admins.length === 0) return { created: 0 };
    const rows = await prisma.adminAlertSetting.findMany({
      where: {
        userId: { in: admins.map((admin) => admin.id) },
        cadence: { in: ['HOURLY', 'DAILY'] },
      },
      select: { userId: true, kind: true, cadence: true },
    });
    const deferred = rows.filter(
      (row): row is typeof row & { cadence: 'HOURLY' | 'DAILY' } =>
        row.cadence === 'HOURLY' || row.cadence === 'DAILY',
    );

    // Hygiene: events whose owner no longer defers that kind can never surface
    // (the digest was switched off mid-window) — mark them consumed now.
    const deferredKeys = new Set(deferred.map((row) => `${row.userId}:${row.kind}`));
    await prisma.adminAlertEvent.updateMany({
      where: {
        flushedAt: null,
        NOT: [...deferredKeys].map((key) => {
          const [userId, kind] = key.split(':');
          return { userId, kind: kind as AdminAlertKind };
        }),
      },
      data: { flushedAt: now },
    });
    if (deferred.length === 0) return { created: 0 };

    let created = 0;
    for (const setting of deferred) {
      if (created >= MAX_ALERTS_PER_FLUSH) break;
      const width = setting.cadence === 'DAILY' ? DAY_MS : HOUR_MS;
      const currentWindowStart = digestWindowStart(setting.cadence, now);
      const events = await prisma.adminAlertEvent.findMany({
        where: {
          userId: setting.userId,
          kind: setting.kind,
          flushedAt: null,
          createdAt: { lt: new Date(currentWindowStart) },
        },
        orderBy: { createdAt: 'asc' },
        take: MAX_EVENTS_PER_FLUSH,
        select: { id: true, title: true, amountPesewas: true, createdAt: true },
      });
      if (events.length === 0) continue;

      const windows = new Map<number, typeof events>();
      for (const event of events) {
        const start = Math.floor(event.createdAt.getTime() / width) * width;
        const bucket = windows.get(start) ?? [];
        bucket.push(event);
        windows.set(start, bucket);
      }
      for (const [windowStart, bucket] of [...windows.entries()].sort((a, b) => a[0] - b[0])) {
        if (created >= MAX_ALERTS_PER_FLUSH) break;
        const digest = digestAlertFor({
          userId: setting.userId,
          kind: setting.kind,
          cadence: setting.cadence,
          windowStart,
          events: bucket,
        });
        await prisma.adminAlert.upsert({
          where: { digestKey: digest.digestKey },
          create: digest,
          update: {},
        });
        await prisma.adminAlertEvent.updateMany({
          where: { id: { in: bucket.map((event) => event.id) } },
          data: { flushedAt: now },
        });
        created += 1;
      }
    }

    // Retention: the feed is a stream, not an archive.
    await prisma.adminAlertEvent.deleteMany({
      where: { flushedAt: { lt: new Date(now.getTime() - EVENT_RETENTION_MS) } },
    });
    await prisma.adminAlert.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - ALERT_RETENTION_MS) } },
    });
    return { created };
  } catch {
    return { created: 0 };
  }
}

/** Effective settings for every kind — defaults filled in, row or not. */
export async function listAdminAlertSettings(userId: string): Promise<
  {
    kind: AdminAlertKind;
    cadence: AdminAlertCadence;
    minAmountPesewas: number | null;
  }[]
> {
  const rows = await prisma.adminAlertSetting.findMany({ where: { userId } });
  return ADMIN_ALERT_KINDS.map((kind) => {
    const row = rows.find((r) => r.kind === kind);
    return {
      kind,
      cadence: row?.cadence ?? DEFAULT_CADENCE,
      minAmountPesewas: row?.minAmountPesewas ?? null,
    };
  });
}
