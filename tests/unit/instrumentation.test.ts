// @vitest-environment node
// Locks the framework invariants of the server-startup seed hook
// (src/instrumentation.ts): the Node-runtime guard and fail-open behavior. The
// agent's seed body lives in src/lib/seed.ts and is mocked here — this test is
// about the envelope, not the seed content, and needs no database.
import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_RUNTIME = process.env.NEXT_RUNTIME;

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  if (ORIGINAL_RUNTIME === undefined) delete process.env.NEXT_RUNTIME;
  else process.env.NEXT_RUNTIME = ORIGINAL_RUNTIME;
});

describe('instrumentation register()', () => {
  it('does NOT run the seed outside the Node.js runtime (edge guard)', async () => {
    process.env.NEXT_RUNTIME = 'edge';
    const seed = vi.fn().mockResolvedValue(undefined);
    vi.doMock('@/lib/seed', () => ({ seed }));

    const { register } = await import('@/instrumentation');
    await expect(register()).resolves.toBeUndefined();
    expect(seed).not.toHaveBeenCalled();
  });

  it('runs the seed once on the Node.js runtime', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    const seed = vi.fn().mockResolvedValue(undefined);
    vi.doMock('@/lib/seed', () => ({ seed }));

    const { register } = await import('@/instrumentation');
    await register();
    expect(seed).toHaveBeenCalledTimes(1);
  });

  it('is fail-open: a throwing seed never rejects, so the server still boots', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    const seed = vi.fn().mockRejectedValue(new Error('seed boom'));
    vi.doMock('@/lib/seed', () => ({ seed }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { register } = await import('@/instrumentation');
    await expect(register()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('instrumentation onRequestError()', () => {
  function mockLedger(captureError: ReturnType<typeof vi.fn>) {
    vi.doMock('@/lib/telemetry', () => ({
      captureError,
      errorMessageOf: (error: unknown) => (error as Error).message,
      errorStackOf: () => null,
      errorDigestOf: () => null,
      routeOf: (pathname: string) => pathname,
    }));
  }

  it('files an escaped server failure, minus its query string, into the ledger', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    const captureError = vi.fn();
    mockLedger(captureError);

    const { onRequestError } = await import('@/instrumentation');
    await onRequestError(
      new Error('boom'),
      { path: '/api/orders?page=2', method: 'GET', headers: {} },
      {} as never,
    );

    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'boom',
        route: '/api/orders',
        method: 'GET',
        status: 500,
        source: 'SERVER',
      }),
    );
  });

  it('stays silent on the edge runtime, where Prisma cannot run', async () => {
    process.env.NEXT_RUNTIME = 'edge';
    const captureError = vi.fn();
    mockLedger(captureError);

    const { onRequestError } = await import('@/instrumentation');
    await onRequestError(
      new Error('boom'),
      { path: '/x', method: 'GET', headers: {} },
      {} as never,
    );

    expect(captureError).not.toHaveBeenCalled();
  });
});
