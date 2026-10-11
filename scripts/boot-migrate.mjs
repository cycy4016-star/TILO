// Boot-time `prisma migrate deploy` with P3009 self-heal.
//
// If a deploy is interrupted mid-migration (or the migration fails), the row
// stays failed in `_prisma_migrations` and `migrate deploy` refuses to do
// anything (P3009) — the service would crash-loop forever. This wrapper
// deletes ONLY failed/incomplete ledger rows and retries; the migration
// directory is kept idempotent (IF [NOT] EXISTS) so a partial run can
// re-apply cleanly. Run inside the container, where the private-network
// database is reachable; healthy boots just run migrate and move on.
import { spawnSync } from 'node:child_process';

const MAX_ATTEMPTS = 3;
const err = (s) => process.stderr.write(s);
const out = (s) => {
  if (s) process.stdout.write(s);
};

function prisma(args, input) {
  const r = spawnSync('npx', ['prisma', ...args], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
    input,
  });
  return { status: r.status ?? 1, text: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

const cleanupSql = (name) =>
  name
    ? `DELETE FROM "_prisma_migrations" WHERE "migration_name" = '${name}';`
    : `DELETE FROM "_prisma_migrations" WHERE "finished_at" IS NULL OR "rolled_back_at" IS NOT NULL;`;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const deploy = prisma(['migrate', 'deploy']);
  out(deploy.text);
  if (deploy.status === 0) process.exit(0);

  if (!/P3009/.test(deploy.text)) process.exit(deploy.status);

  const name = /The `([^`]+)` migration/.exec(deploy.text)?.[1] ?? '';
  err(
    `boot-migrate: stuck ledger entry${name ? ` for "${name}"` : ''} (P3009) — deleting and retrying (attempt ${attempt}/${MAX_ATTEMPTS})\n`,
  );
  const del = prisma(['db', 'execute', '--schema', 'prisma/schema', '--stdin'], cleanupSql(name));
  out(del.text);
  if (del.status !== 0) process.exit(del.status);
}

err('boot-migrate: migrate deploy still failing after heal attempts\n');
process.exit(1);
