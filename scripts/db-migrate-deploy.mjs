// Build-time wrapper around `prisma migrate deploy`.
//
// Railway's build sandbox has no private-network route to the database
// (tilo-db.railway.internal is only resolvable between running services), so a
// migrate-during-build fails with P1001 even when the deploy itself is fine.
// Migrations are authoritative at BOOT — `prestart` and railway.toml's
// startCommand run the real `prisma migrate deploy` when the DB is reachable.
//
// This wrapper keeps build-time migrate useful where the DB IS reachable
// (Render, local runs) but soft-skips ONLY unreachable-database failures.
// Every other failure — bad SQL, auth errors, missing migrations — still
// fails the build hard.
import { spawnSync } from 'node:child_process';

const UNREACHABLE_DB =
  /P1001|P1002|Can't reach database server|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|getaddrinfo|Connection refused/i;

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
  env: process.env,
});

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
if (output) process.stdout.write(output);

if (result.error) {
  process.stderr.write(`db-migrate-deploy: could not launch prisma: ${result.error.message}\n`);
  process.exit(1);
}

if (result.status === 0) process.exit(0);

if (UNREACHABLE_DB.test(output)) {
  process.stderr.write(
    'db-migrate-deploy: database unreachable from this environment — continuing without migrating.\n' +
      'db-migrate-deploy: migrations will be applied at boot (prestart / start command) once the DB is reachable.\n',
  );
  process.exit(0);
}

process.exit(result.status ?? 1);
