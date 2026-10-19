// Vault restore: put an archived world back into the database.
//
//   npm run vault:restore -- <snapshot-id>            (row from world_snapshot)
//   npm run vault:restore -- tilza-vault-2026-....json (file downloaded from F10)
//   npm run vault:restore -- <id> --dry-run           (plan only, no writes)
//
// Rows are upserted by id in foreign-key order, so a restore over a partially
// wiped database rebuilds exactly what the snapshot held and leaves everything
// else alone. Snapshot payloads are JSON-shaped: dates are ISO strings and
// images (when the snapshot included them) are base64 — both are converted
// back here. Caller must provide DATABASE_URL (CI job env) or have .env.local
// present (local runs).
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  for (const file of ['.env.local', '.env']) {
    if (existsSync(file)) {
      try {
        process.loadEnvFile(file);
        break;
      } catch {
        // Ignore malformed env files; Prisma will report a missing URL.
      }
    }
  }
}

const input = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!input) {
  console.error('usage: npm run vault:restore -- <snapshot-id | tilza-vault-*.json> [--dry-run]');
  process.exit(1);
}

const DATE_FIELDS = {
  users: ['banExpires', 'trialEndsAt', 'createdAt', 'updatedAt'],
  stores: ['createdAt', 'updatedAt'],
  categories: ['createdAt', 'updatedAt'],
  items: ['createdAt', 'updatedAt'],
  itemGallery: ['createdAt', 'updatedAt'],
  promotions: ['startsAt', 'endsAt', 'createdAt', 'updatedAt'],
  socials: ['createdAt', 'updatedAt'],
  customers: ['lastInquiryAt', 'createdAt', 'updatedAt'],
  orders: ['paidAt', 'createdAt', 'updatedAt'],
  orderLines: ['createdAt'],
  feedback: ['createdAt', 'updatedAt'],
  adminAlerts: ['windowStart', 'windowEnd', 'readAt', 'createdAt'],
  authEvents: ['createdAt'],
};

const BYTE_FIELDS = {
  stores: { logoB64: 'logo', bannerB64: 'banner' },
  categories: { coverB64: 'cover' },
  items: { imageB64: 'image' },
  itemGallery: { imageB64: 'image' },
  promotions: { imageB64: 'image' },
};

// Foreign-key order: a row's parent must exist before the row itself.
const TABLES = [
  { key: 'users', model: 'user' },
  { key: 'stores', model: 'store' },
  { key: 'categories', model: 'productCategory' },
  { key: 'items', model: 'storeItem' },
  { key: 'itemGallery', model: 'storeItemImage' },
  { key: 'promotions', model: 'promotion' },
  { key: 'socials', model: 'socialAccount' },
  { key: 'customers', model: 'customer' },
  { key: 'orders', model: 'order' },
  { key: 'orderLines', model: 'orderLineItem' },
  { key: 'feedback', model: 'feedback' },
  { key: 'adminAlerts', model: 'adminAlert' },
  { key: 'authEvents', model: 'authEvent' },
];

function rowFor(tableKey, row) {
  const out = { ...row };
  for (const field of DATE_FIELDS[tableKey] ?? []) {
    if (out[field] != null) out[field] = new Date(out[field]);
  }
  for (const [b64Field, byteField] of Object.entries(BYTE_FIELDS[tableKey] ?? {})) {
    if (out[b64Field] != null) out[byteField] = Buffer.from(out[b64Field], 'base64');
    delete out[b64Field];
  }
  return out;
}

const prisma = new PrismaClient();

async function loadPayload() {
  if (input.endsWith('.json') || existsSync(input)) {
    return JSON.parse(await readFile(input, 'utf8'));
  }
  const snapshot = await prisma.worldSnapshot.findUnique({
    where: { id: input },
    select: { payload: true, createdAt: true },
  });
  if (!snapshot) throw new Error(`No snapshot with id "${input}" — check F10 in the terminal.`);
  console.log(`Loaded snapshot ${input} taken ${snapshot.createdAt.toISOString()}`);
  return snapshot.payload;
}

async function main() {
  const payload = await loadPayload();
  if (payload?.version !== 1)
    throw new Error('Unrecognised snapshot payload (expected version 1).');

  console.log(
    `World taken ${payload.takenAt} · images ${payload.imagesIncluded ? 'included' : 'NOT included (text-only)'}${dryRun ? ' · DRY RUN' : ''}`,
  );

  let total = 0;
  for (const { key, model } of TABLES) {
    const rows = Array.isArray(payload[key]) ? payload[key] : [];
    if (rows.length === 0) {
      console.log(`  ${key}: none`);
      continue;
    }
    if (!dryRun) {
      for (const row of rows) {
        const data = rowFor(key, row);
        await prisma[model].upsert({ where: { id: row.id }, create: data, update: data });
      }
    }
    total += rows.length;
    console.log(`  ${key}: ${rows.length} ${dryRun ? 'to restore' : 'restored'}`);
  }
  console.log(
    dryRun ? `Plan complete — ${total} rows would be upserted.` : `Done — ${total} rows restored.`,
  );
}

main()
  .catch((error) => {
    console.error('vault-restore failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
