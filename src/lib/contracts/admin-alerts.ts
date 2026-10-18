// Client-safe contracts for the operator alert stream: the feed the terminal's
// ALERTS panel polls, the per-kind cadence rules the settings editor writes,
// and the mark-read result. Mirrors prisma/schema/admin-alerts.prisma.
import { z } from 'zod';

export const AlertKind = z.enum(['SIGNUP', 'STORE', 'ORDER', 'PAYMENT', 'INCIDENT', 'FEEDBACK']);

export const AlertCadence = z.enum(['OFF', 'INSTANT', 'HOURLY', 'DAILY']);

export const AlertRecord = z.object({
  id: z.string(),
  kind: AlertKind,
  title: z.string(),
  body: z.string().nullable(),
  // Sum in pesewas for digests; the single amount for instant rows.
  amountPesewas: z.number().int().nullable(),
  // How many activities rolled into this row (1 for instant alerts).
  count: z.number().int().positive(),
  // Digest windows only — instant rows carry null.
  windowStart: z.string().datetime().nullable(),
  windowEnd: z.string().datetime().nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const AlertSettingRecord = z.object({
  kind: AlertKind,
  cadence: AlertCadence,
  // ORDER/PAYMENT only: alerts below this floor (pesewas) stay silent.
  minAmountPesewas: z.number().int().nonnegative().nullable(),
});

export const AlertsFeed = z.object({
  alerts: z.array(AlertRecord),
  unread: z.number().int().nonnegative(),
  settings: z.array(AlertSettingRecord),
  generatedAt: z.string().datetime(),
});

export const AlertsReadResult = z.object({ unread: z.number().int().nonnegative() });

export const AlertsSettingsResult = z.object({ settings: z.array(AlertSettingRecord) });

export const AlertsSettingsUpdate = z.object({
  kind: AlertKind,
  cadence: AlertCadence,
  // null clears the floor. Bounded so a typo cannot silently mute everything.
  minAmountPesewas: z.number().int().nonnegative().max(100_000_00).nullable().optional(),
});

export type AlertKindValue = z.infer<typeof AlertKind>;
export type AlertCadenceValue = z.infer<typeof AlertCadence>;
export type AlertRecord = z.infer<typeof AlertRecord>;
export type AlertSettingRecord = z.infer<typeof AlertSettingRecord>;
export type AlertsFeed = z.infer<typeof AlertsFeed>;
export type AlertsSettingsUpdate = z.infer<typeof AlertsSettingsUpdate>;
