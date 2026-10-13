// Next.js server-startup hook.
//
// Next calls register() ONCE when the server process boots. We use it to run the
// app's idempotent startup seed AFTER the schema is applied, so by the time this
// fires the tables exist. Put seed logic in src/lib/seed.ts — this file only owns
// the correctness envelope:
//   - Node-runtime guard: register() ALSO fires for the edge runtime, where Prisma
//     cannot run, so we return early there.
//   - fail-open: a throwing seed is logged and swallowed, never re-thrown, so a bad
//     seed can never stop the server from booting.
import type { Instrumentation } from 'next';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  try {
    const { seed } = await import('@/lib/seed');
    await seed();
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: startup diagnostics — the seed failed but the server still boots.
    console.error('[tilo] startup seed failed:', error);
  }
}

/**
 * Second net under the API routes: every route handler catches its own errors
 * and reports them through routeErrorResponse, but anything that escapes — a
 * Server Component render, a Server Action, a handler with no try/catch —
 * reaches Next here and is filed in the same AppLog ledger.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, _context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  return reportServerError(error, request);
};

async function reportServerError(
  error: unknown,
  request: { path: string; method: string },
): Promise<void> {
  const { captureError, errorDigestOf, errorMessageOf, errorStackOf, routeOf } = await import(
    '@/lib/telemetry'
  );
  // `path` can carry a query string; group on the path alone.
  const pathname = request.path.split('?')[0] || '/';
  captureError({
    error,
    message: errorMessageOf(error),
    stack: errorStackOf(error),
    digest: errorDigestOf(error),
    route: routeOf(pathname),
    method: request.method,
    status: 500,
    source: 'SERVER',
  });
}
