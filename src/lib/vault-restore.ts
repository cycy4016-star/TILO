// In-app vault restore — the operator's undo button for silent data loss.
//
// The defining safety property: this restore can only ADD rows. Every snapshot
// row is inserted with `skipDuplicates`, so a row that already exists is left
// exactly as it is — the restore can never overwrite today's work or delete
// anything. It is the inverse of loss, never a rollback.
//
// Practical details mirror scripts/vault-restore.mjs (same foreign-key order,
// same ISO-date and base64-image conversions) because both read the same
// payload format. The script upserts and is for a machine; this module inserts
// missing rows and is safe for a human to press.
import 'server-only';

import { prisma } from '@/lib/db';

export type VaultRestoreResult = {
  snapshotId: string;
  takenAt: string | null;
  imagesIncluded: boolean;
  restored: number;
  skipped: number;
  byTable: { key: string; restored: number; skipped: number }[];
};

// Same maps as the CLI script: snapshot payloads are JSON-shaped.
const DATE_FIELDS: Record<string, string[]> = {
  users: ['banExpires', 'trialEndsAt', 'createdAt', 'updatedAt'],
  stores: ['createdAt', 'updatedAt'],
  categories: ['createdAt', 'updatedAt'],
  items: ['createdAt', 'updatedAt'],
  promotions: ['startsAt', 'endsAt', 'createdAt', 'updatedAt'],
  socials: ['createdAt', 'updatedAt'],
  customers: ['lastInquiryAt', 'createdAt', 'updatedAt'],
  orders: ['paidAt', 'createdAt', 'updatedAt'],
  orderLines: ['createdAt'],
  feedback: ['createdAt', 'updatedAt'],
  adminAlerts: ['windowStart', 'windowEnd', 'readAt', 'createdAt'],
  authEvents: ['createdAt'],
};

const BYTE_FIELDS: Record<string, Record<string, string>> = {
  stores: { logoB64: 'logo', bannerB64: 'banner' },
  categories: { coverB64: 'cover' },
  items: { imageB64: 'image' },
  promotions: { imageB64: 'image' },
};

// Foreign-key order: a row's parent must exist before the row itself.
const TABLES = [
  { key: 'users', model: 'user' },
  { key: 'stores', model: 'store' },
  { key: 'categories', model: 'productCategory' },
  { key: 'items', model: 'storeItem' },
  { key: 'promotions', model: 'promotion' },
  { key: 'socials', model: 'socialAccount' },
  { key: 'customers', model: 'customer' },
  { key: 'orders', model: 'order' },
  { key: 'orderLines', model: 'orderLineItem' },
  { key: 'feedback', model: 'feedback' },
  { key: 'adminAlerts', model: 'adminAlert' },
  { key: 'authEvents', model: 'authEvent' },
] as const;

// Prisma's generated delegates are strongly typed per model; a data-driven
// restore walks them dynamically. The structural type keeps the cast contained.
type CreateDelegate = {
  createMany: (args: { data: unknown[]; skipDuplicates: boolean }) => Promise<{ count: number }>;
  create: (args: { data: unknown }) => Promise<unknown>;
};

// Postgres allows 65535 bind parameters per statement; big image payloads make
// wide rows, so keep batches modest and chunky.
const BATCH = 250;

function rowFor(tableKey: string, row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  for (const field of DATE_FIELDS[tableKey] ?? []) {
    if (out[field] != null) out[field] = new Date(out[field] as string);
  }
  for (const [b64Field, byteField] of Object.entries(BYTE_FIELDS[tableKey] ?? {})) {
    if (out[b64Field] != null) out[byteField] = Buffer.from(out[b64Field] as string, 'base64');
    delete out[b64Field];
  }
  return out;
}

/**
 * Bring back every row the snapshot holds that the live database no longer
 * has. Existing rows are untouched (id conflict → skipped). If a batch insert
 * trips over a unique rule that id-skipping cannot absorb, the batch falls back
 * to row-by-row so one odd row cannot sink the whole restore — each failure is
 * counted as skipped, never hidden.
 */
export async function restoreMissingFromSnapshot(snapshotId: string): Promise<VaultRestoreResult> {
  const snapshot = await prisma.worldSnapshot.findUnique({
    where: { id: snapshotId },
    select: { id: true, createdAt: true, payload: true },
  });
  if (!snapshot) throw Response.json({ error: 'Not found' }, { status: 404 });

  const payload = (snapshot.payload ?? {}) as Record<string, unknown>;
  if (payload.version !== 1) {
    throw Response.json(
      { error: 'Unrecognised snapshot payload (expected version 1)' },
      { status: 400 },
    );
  }

  let restored = 0;
  let skipped = 0;
  const byTable: VaultRestoreResult['byTable'] = [];

  for (const { key, model } of TABLES) {
    const raw = payload[key];
    const rows = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
    if (rows.length === 0) continue;

    const delegate = (prisma as unknown as Record<string, CreateDelegate>)[model];
    if (!delegate) continue;
    let tableRestored = 0;
    let tableSkipped = 0;

    for (let index = 0; index < rows.length; index += BATCH) {
      const data = rows.slice(index, index + BATCH).map((row) => rowFor(key, row));
      try {
        const result = await delegate.createMany({ data, skipDuplicates: true });
        tableRestored += result.count;
        tableSkipped += data.length - result.count;
      } catch {
        // A unique rule beyond the primary key (a reused slug or email) can
        // abort a whole batch — walk it row by row so one odd row cannot sink
        // the rest of a table's recovery.
        for (const row of data) {
          try {
            await delegate.create({ data: row });
            tableRestored += 1;
          } catch {
            tableSkipped += 1;
          }
        }
      }
    }

    restored += tableRestored;
    skipped += tableSkipped;
    byTable.push({ key, restored: tableRestored, skipped: tableSkipped });
  }

  return {
    snapshotId: snapshot.id,
    takenAt:
      typeof payload.takenAt === 'string' ? payload.takenAt : snapshot.createdAt.toISOString(),
    imagesIncluded: payload.imagesIncluded === true,
    restored,
    skipped,
    byTable,
  };
}
