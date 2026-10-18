// The doctor: a self-check the operator can run from the terminal when
// something feels wrong — or just to be told everything is fine. It performs
// the same examinations a developer would do first (is the database answering,
// is the schema current, is the archive baseline intact, is sign-up open, is
// the owner wired up, are incidents stacking, are photos filling the database,
// is mail/payment configured) and writes every result as one plain sentence a
// non-technical operator can read, plus numbered steps for what to do when a
// check is not happy.
//
// Two rules govern this file:
//   1. A check must never throw out of the report. If one examination crashes,
//      the crash itself becomes that check's FAIL with the reason — the other
//      checks still run and the operator still gets an answer.
//   2. Every verdict must be provable from live data. No cached readings, no
//      assumptions — each run hits the database and the filesystem directly.
import 'server-only';

import { readdirSync } from 'node:fs';
import path from 'node:path';
import type { AdminDoctorCheck, AdminDoctorStatus } from '@/lib/contracts/admin';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { isAdminRole } from '@/lib/roles';
import { currentWorldCounts, listWorldSnapshots } from '@/lib/vault';
import { diffWorlds, lossHeadline } from '@/lib/vault-diff';

export type DoctorReport = {
  checkedAt: string;
  durationMs: number;
  status: AdminDoctorStatus;
  passed: number;
  warnings: number;
  failures: number;
  checks: AdminDoctorCheck[];
};

/** Human sizes: "17 MB" / "1.2 GB" — the way a non-developer reads them. */
function sizeLabel(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

function hoursSince(value: string): number {
  return (Date.now() - new Date(value).getTime()) / 3_600_000;
}

const RERUN = 'Run the checks again to confirm the fix.';

type CheckMeta = Pick<AdminDoctorCheck, 'id' | 'area' | 'title'>;

type CheckResult = Pick<AdminDoctorCheck, 'status' | 'summary' | 'detail' | 'actions'>;

/**
 * Run one examination. Any throw becomes this check's FAIL rather than the
 * report's death — the operator asked what is wrong, and "this check itself
 * could not run" is an honest answer with its own fix (redeploy).
 */
async function safeCheck(meta: CheckMeta, run: () => Promise<CheckResult>) {
  try {
    return { ...meta, ...(await run()) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...meta,
      status: 'fail' as const,
      summary: 'This check could not run — the platform did not answer it.',
      detail: message.slice(0, 400),
      actions: [
        'Redeploy the app: in Railway open the tilo service, then Deployments → ⋮ → Redeploy.',
        'When the redeploy finishes, run the checks again.',
        'If this check still crashes, copy the full report and send it to whoever supports the platform.',
      ],
    };
  }
}

// ── the examinations ─────────────────────────────────────────────────────────

async function checkDatabase(): Promise<CheckResult> {
  const started = performance.now();
  await prisma.$queryRawUnsafe('SELECT 1');
  const ms = Math.max(1, Math.round(performance.now() - started));
  return {
    status: 'pass',
    summary: `The database answered in ${ms} ms — the record of every shop is reachable.`,
    detail: null,
    actions: [],
  };
}

async function checkMigrations(): Promise<CheckResult> {
  const folder = path.join(process.cwd(), 'prisma', 'migrations');
  const onDisk = readdirSync(folder).filter((name) => /^\d{8,}/.test(name));
  const applied = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
  );
  const appliedNames = new Set(applied.map((row) => row.migration_name));
  const pending = onDisk.filter((name) => !appliedNames.has(name));

  if (pending.length > 0) {
    return {
      status: 'warn',
      summary: `The database is behind the code by ${pending.length} update${pending.length === 1 ? '' : 's'} — this usually finishes at the next restart.`,
      detail: `Pending: ${pending.join(', ')}`,
      actions: [
        'Restart the app so it re-runs its start-up updates: Railway → tilo service → Deployments → ⋮ → Redeploy.',
        RERUN,
      ],
    };
  }
  return {
    status: 'pass',
    summary: `The database layout matches the code — all ${onDisk.length} updates are applied.`,
    detail: null,
    actions: [],
  };
}

async function checkVault(): Promise<CheckResult> {
  const [snapshots, current] = await Promise.all([listWorldSnapshots(1), currentWorldCounts()]);
  const latest = snapshots[0];

  if (!latest) {
    return {
      status: 'warn',
      summary: 'No archive baseline exists yet, so sudden data loss would go unnoticed.',
      detail: null,
      actions: [
        'Open the VAULT tab (F10) and press “Snapshot now” — that baseline is what later losses are measured against.',
        RERUN,
      ],
    };
  }

  const loss = diffWorlds(latest.counts, current);
  if (loss.length > 0) {
    return {
      status: 'fail',
      summary: `${lossHeadline(loss)} vanished from the live database since the ${new Date(latest.createdAt).toUTCString()} snapshot.`,
      detail: loss
        .map((entry) => `${entry.label}: was ${entry.before}, now ${entry.after}`)
        .join(' · '),
      actions: [
        'Open the VAULT tab (F10) and download the newest snapshot as JSON — keep that file, it is the record of what was lost.',
        `Restore it from the machine that maintains the platform: npm run vault:restore -- ${latest.id}`,
        'Then come back here and run the checks again — the vault check must go green.',
      ],
    };
  }

  const age = hoursSince(latest.createdAt);
  if (age > 30) {
    return {
      status: 'warn',
      summary: `The newest archive is ${Math.round(age)}h old — the daily snapshot looks stalled.`,
      detail: `Newest snapshot: ${latest.id} · ${latest.trigger} · ${new Date(latest.createdAt).toUTCString()}`,
      actions: [
        'Restart the app — it takes a fresh archive on every boot: Railway → tilo service → Deployments → ⋮ → Redeploy.',
        'Open the VAULT tab (F10) and press “Snapshot now” if you want one immediately.',
      ],
    };
  }

  return {
    status: 'pass',
    summary: `The world was archived ${Math.max(1, Math.round(age))}h ago and the live tallies still match it — nothing has gone missing.`,
    detail: `Baseline: ${latest.id} · ${latest.trigger}`,
    actions: [],
  };
}

async function checkSignups(): Promise<CheckResult> {
  const users = await prisma.user.count();
  const limit = env.SIGNUP_LIMIT;

  if (limit == null) {
    return {
      status: 'pass',
      summary: `Sign-ups are open — no account cap is set (${users} account${users === 1 ? '' : 's'} so far).`,
      detail: null,
      actions: [],
    };
  }

  const remaining = limit - users;
  if (remaining <= 0) {
    return {
      status: 'fail',
      summary: `New sign-ups are BLOCKED — the account cap of ${limit} is full and the platform is turning people away.`,
      detail: `SIGNUP_LIMIT=${limit} · accounts: ${users}`,
      actions: [
        'In Railway open the tilo service → Variables.',
        'Raise SIGNUP_LIMIT to a higher number — or delete the variable entirely to remove the cap.',
        'Railway redeploys on its own; when it finishes, run the checks again.',
      ],
    };
  }
  if (remaining <= Math.ceil(limit * 0.25)) {
    return {
      status: 'warn',
      summary: `Only ${remaining} of ${limit} sign-up slots are left — the platform will start blocking new accounts soon.`,
      detail: `SIGNUP_LIMIT=${limit} · accounts: ${users}`,
      actions: [
        'Decide whether the cap should rise: in Railway open the tilo service → Variables.',
        'Raise SIGNUP_LIMIT — or delete the variable entirely to remove the cap.',
      ],
    };
  }
  return {
    status: 'pass',
    summary: `Sign-ups are open: ${users} of ${limit} slots used, ${remaining} left before the cap closes sign-up.`,
    detail: null,
    actions: [],
  };
}

async function checkOwner(): Promise<CheckResult> {
  const ownerEmail = env.ADMIN_EMAIL;

  if (!ownerEmail) {
    const promoted = await prisma.user.count({ where: { role: { contains: 'admin' } } });
    if (promoted === 0) {
      return {
        status: 'warn',
        summary:
          'No owner account is designated — nobody holds platform powers, and the monitor has no keeper.',
        detail: 'ADMIN_EMAIL is not set.',
        actions: [
          'In Railway open the tilo service → Variables and set ADMIN_EMAIL to the address of the owner account.',
          'That address gets the powers the next time it signs up; if the account already exists, promote it from the ACCOUNTS tab (F3).',
        ],
      };
    }
    return {
      status: 'pass',
      summary: `ADMIN_EMAIL is empty, but ${promoted} account${promoted === 1 ? '' : 's'} already ${promoted === 1 ? 'holds' : 'hold'} platform powers.`,
      detail: null,
      actions: [],
    };
  }

  const owner = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true, role: true, banned: true },
  });

  if (!owner) {
    return {
      status: 'warn',
      summary: `The owner address ${ownerEmail} has no account yet — the powers apply the moment it signs up.`,
      detail: null,
      actions: [
        'If that is the wrong address, fix ADMIN_EMAIL in Railway → tilo service → Variables.',
        'Otherwise simply sign up with it — the account is promoted automatically.',
      ],
    };
  }
  if (owner.banned) {
    return {
      status: 'fail',
      summary: `The owner account (${ownerEmail}) is suspended — platform powers are locked out.`,
      detail: null,
      actions: ['Open the ACCOUNTS tab (F3), find that account and restore it.', RERUN],
    };
  }
  if (!isAdminRole(owner.role)) {
    return {
      status: 'fail',
      summary: `The owner account (${ownerEmail}) exists but is not marked as operator — the monitor may be unreachable.`,
      detail: `Current role: ${owner.role ?? 'user'}`,
      actions: [
        'Open the ACCOUNTS tab (F3) and promote that account to admin.',
        'Or sign in as the owner once more — the role is applied at sign-up.',
      ],
    };
  }
  return {
    status: 'pass',
    summary: `The owner account (${ownerEmail}) is in place with full platform powers.`,
    detail: null,
    actions: [],
  };
}

async function checkIncidents(): Promise<CheckResult> {
  const [open, recent] = await Promise.all([
    prisma.appLog.count({ where: { resolvedAt: null } }),
    prisma.appLog.aggregate({
      _sum: { count: true },
      where: { lastSeenAt: { gte: new Date(Date.now() - 86_400_000) } },
    }),
  ]);
  const occurrences = recent._sum.count ?? 0;

  if (open === 0) {
    return {
      status: 'pass',
      summary:
        occurrences > 0
          ? `No open incidents — the ${occurrences} failure${occurrences === 1 ? '' : 's'} from the last day ${occurrences === 1 ? 'is' : 'are'} already marked fixed and ${occurrences === 1 ? 'has' : 'have'} not returned.`
          : 'No open incidents — nothing has failed recently.',
      detail: null,
      actions: [],
    };
  }
  return {
    status: 'warn',
    summary: `${open} incident${open === 1 ? ' is' : 's are'} open${occurrences > 0 ? ` · ${occurrences} failure${occurrences === 1 ? '' : 's'} in the last day` : ''}. Each one has a plain-words fix on its row.`,
    detail: null,
    actions: [
      'Open the HEALTH tab (F6) and press GUIDE on each open row — every incident now explains itself in plain words.',
      'Press Resolve once an incident is dealt with; if it comes back, it reopens by itself.',
      'If an incident keeps returning, copy its reference from the GUIDE panel and send it with a DOCTOR report.',
    ],
  };
}

async function checkPhotos(): Promise<CheckResult> {
  const imageRows = await prisma.$queryRawUnsafe<{ bytes: bigint | number }[]>(
    `SELECT
       COALESCE((SELECT SUM(COALESCE(octet_length(logo), 0) + COALESCE(octet_length(banner), 0)) FROM "Store"), 0)
     + COALESCE((SELECT SUM(octet_length(cover)) FROM "ProductCategory" WHERE cover IS NOT NULL), 0)
     + COALESCE((SELECT SUM(octet_length(image)) FROM "StoreItem" WHERE image IS NOT NULL), 0)
     + COALESCE((SELECT SUM(octet_length(image)) FROM "Promotion" WHERE image IS NOT NULL), 0)
     AS bytes`,
  );
  const sizeRows = await prisma.$queryRawUnsafe<{ bytes: bigint | number }[]>(
    'SELECT pg_database_size(current_database()) AS bytes',
  );
  const photoBytes = Number(imageRows[0]?.bytes ?? 0);
  const dbBytes = Number(sizeRows[0]?.bytes ?? 0);
  const detail = `Photos and logos: ${sizeLabel(photoBytes)} · database total: ${sizeLabel(dbBytes)}`;

  if (photoBytes > 1_000_000_000) {
    return {
      status: 'warn',
      summary: `Catalogue photos now take ${sizeLabel(photoBytes)} of the database — it will need more room soon.`,
      detail,
      actions: [
        'In Railway, give the tilo-db service a larger volume.',
        'Or ask shops to replace very large photos with smaller ones — each photo is resized on upload, but volume adds up.',
      ],
    };
  }
  return {
    status: 'pass',
    summary: `Image storage is healthy — ${sizeLabel(photoBytes)} of photos across every shop.`,
    detail,
    actions: [],
  };
}

async function checkLedger(): Promise<CheckResult> {
  const [users, signups] = await Promise.all([
    prisma.user.count(),
    prisma.authEvent.count({ where: { kind: 'SIGNUP' } }),
  ]);
  const missing = users - signups;

  if (missing > 0) {
    return {
      status: 'warn',
      summary: `${missing} account${missing === 1 ? '' : 's'} predate${missing === 1 ? 's' : ''} the sign-up ledger — their arrival was never written to the tape.`,
      detail: `Accounts: ${users} · ledger sign-ups: ${signups}`,
      actions: [
        'No action needed — the gap is historical and cannot be back-filled.',
        'Every new sign-up lands on the ledger automatically, so the tape is complete from now on.',
      ],
    };
  }
  return {
    status: 'pass',
    summary: `Every one of the ${users} account${users === 1 ? '' : 's'} has its sign-up row on the permanent tape.`,
    detail: null,
    actions: [],
  };
}

async function checkMail(): Promise<CheckResult> {
  if (env.EMAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) {
    return {
      status: 'fail',
      summary: 'Email is switched on but has no key — password-reset links cannot be sent.',
      detail: 'EMAIL_PROVIDER=resend · RESEND_API_KEY is not set.',
      actions: [
        'In Railway open the tilo service → Variables.',
        'Either add RESEND_API_KEY (from resend.com) — or set EMAIL_PROVIDER to none to switch email off honestly.',
      ],
    };
  }
  if (env.EMAIL_PROVIDER === 'resend') {
    return {
      status: 'pass',
      summary: 'Email is armed — password-reset links will send.',
      detail: null,
      actions: [],
    };
  }
  return {
    status: 'pass',
    summary: 'Email sending is off — everything works, but password-reset links are never sent.',
    detail: null,
    actions: [],
  };
}

async function checkPayments(): Promise<CheckResult> {
  if (env.PAYSTACK_SECRET_KEY) {
    return {
      status: 'pass',
      summary: 'Card payments are armed — checkout can take online payment.',
      detail: null,
      actions: [],
    };
  }
  return {
    status: 'pass',
    summary: 'Card payments are off — checkout shows shops their direct-payment details instead.',
    detail: 'PAYSTACK_SECRET_KEY is not set.',
    actions: [],
  };
}

// ── the report ───────────────────────────────────────────────────────────────

/**
 * Examine everything and report honestly. Runs sequentially — the whole suite
 * takes a few hundred milliseconds, and a serial run keeps the database-latency
 * reading true instead of measuring the doctor's own parallel load.
 */
export async function runDoctor(): Promise<DoctorReport> {
  const started = performance.now();

  const checks = [
    await safeCheck({ id: 'db', area: 'DB', title: 'Database' }, checkDatabase),
    await safeCheck({ id: 'migrations', area: 'MIG', title: 'Schema updates' }, checkMigrations),
    await safeCheck({ id: 'vault', area: 'VLT', title: 'Archive integrity' }, checkVault),
    await safeCheck({ id: 'signups', area: 'SGN', title: 'Sign-ups' }, checkSignups),
    await safeCheck({ id: 'owner', area: 'OWN', title: 'Owner account' }, checkOwner),
    await safeCheck({ id: 'incidents', area: 'INC', title: 'Incidents' }, checkIncidents),
    await safeCheck({ id: 'photos', area: 'IMG', title: 'Photo storage' }, checkPhotos),
    await safeCheck({ id: 'ledger', area: 'LDG', title: 'Sign-up ledger' }, checkLedger),
    await safeCheck({ id: 'mail', area: 'MAIL', title: 'Email' }, checkMail),
    await safeCheck({ id: 'payments', area: 'PAY', title: 'Payments' }, checkPayments),
  ];

  const failures = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;
  const passed = checks.length - failures - warnings;
  const status: AdminDoctorStatus = failures > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass';

  return {
    checkedAt: new Date().toISOString(),
    durationMs: Math.max(1, Math.round(performance.now() - started)),
    status,
    passed,
    warnings,
    failures,
    checks,
  };
}
