// @vitest-environment node
//
// Error-ledger tests: the telemetry helpers that turn a raw failure into one
// grouped, human-readable incident — grouping, route normalisation, and the
// routeErrorResponse contract every API catch block now delegates to.
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const db = vi.hoisted(() => ({ prisma: { appLog: { upsert: vi.fn() } } }));
vi.mock('@/lib/db', () => db);

// Long enough to trip the cuid-shaped collapse rule in normalizeForFingerprint.
const ID_A = 'cmf000000000000000000000a';
const ID_B = 'cmf000000000000000000000b';

describe('fingerprinting', () => {
  it('folds ids and numbers so the same bug is ONE row', async () => {
    const { fingerprintOf } = await import('@/lib/telemetry');
    const first = fingerprintOf({
      message: `No order found for ${ID_A}`,
      route: `/api/orders/${ID_A}`,
      method: 'GET',
    });
    const second = fingerprintOf({
      message: `No order found for ${ID_B}`,
      route: `/api/orders/${ID_B}`,
      method: 'GET',
    });
    expect(first).toBe(second);
  });

  it('keeps genuinely different failures apart', async () => {
    const { fingerprintOf } = await import('@/lib/telemetry');
    const timeout = fingerprintOf({
      message: 'Upstream timed out',
      route: '/api/x',
      method: 'GET',
    });
    const denied = fingerprintOf({ message: 'Not allowed', route: '/api/x', method: 'GET' });
    expect(timeout).not.toBe(denied);
  });

  it('collapses volatile path segments to :id and leaves plain ones alone', async () => {
    const { routeOf } = await import('@/lib/telemetry');
    expect(routeOf(`/api/orders/${ID_A}`)).toBe('/api/orders/:id');
    expect(routeOf('/dashboard')).toBe('/dashboard');
  });
});

describe('routeErrorResponse', () => {
  it('lets a thrown Response (4xx control flow) through untouched', async () => {
    const { routeErrorResponse } = await import('@/lib/telemetry');
    const thrown = Response.json({ error: 'Gone' }, { status: 404 });
    const response = routeErrorResponse(thrown, new Request('http://test/api/x'));
    expect(response).toBe(thrown);
    expect(db.prisma.appLog.upsert).not.toHaveBeenCalled();
  });

  it('files everything else as a 500 incident and answers generically', async () => {
    const { routeErrorResponse } = await import('@/lib/telemetry');
    const response = routeErrorResponse(new Error('kaboom'), new Request('http://test/api/orders'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Internal Server Error' });
    expect(db.prisma.appLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          message: 'kaboom',
          route: '/api/orders',
          method: 'GET',
          status: 500,
        }),
      }),
    );
  });

  it('never lets a broken ledger take the response down with it', async () => {
    const { routeErrorResponse } = await import('@/lib/telemetry');
    db.prisma.appLog.upsert.mockRejectedValueOnce(new Error('table missing'));
    const response = routeErrorResponse(new Error('kaboom'), new Request('http://test/api/x'));
    expect(response.status).toBe(500);
  });
});
