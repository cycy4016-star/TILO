// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ requireAuth: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    order: { findUnique: vi.fn(), updateMany: vi.fn() },
    userAudience: { upsert: vi.fn() },
  },
}));

vi.mock('@/lib/require-auth', () => auth);
vi.mock('@/lib/db', () => db);
vi.mock('server-only', () => ({}));

import { resolveShopperClaimState } from '@/lib/order-claim';
import { signOrderToken } from '@/lib/order-tracking';

const context = (token: string) => ({ params: Promise.resolve({ token }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ORDER_TRACKING_SECRET', 'shopper-claim-test-secret');
  auth.requireAuth.mockResolvedValue({ id: 'shopper-1', email: 'shopper@test.dev' });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('shopper claim state', () => {
  it('separates guest, claimable, claimed and owner views', () => {
    expect(
      resolveShopperClaimState({ orderUserId: 'owner', shopperId: null, viewerId: null }),
    ).toBe('signed-out');
    expect(
      resolveShopperClaimState({ orderUserId: 'owner', shopperId: null, viewerId: 'shopper' }),
    ).toBe('claimable');
    expect(
      resolveShopperClaimState({ orderUserId: 'owner', shopperId: 'shopper', viewerId: 'shopper' }),
    ).toBe('claimed');
    expect(
      resolveShopperClaimState({ orderUserId: 'owner', shopperId: 'other', viewerId: 'shopper' }),
    ).toBe('claimed-other');
    expect(
      resolveShopperClaimState({ orderUserId: 'owner', shopperId: null, viewerId: 'owner' }),
    ).toBe('owner');
  });
});

describe('public order claim route', () => {
  it('requires a signed-in shopper', async () => {
    auth.requireAuth.mockRejectedValueOnce(
      Response.json({ error: 'Unauthorized' }, { status: 401 }),
    );
    const { POST } = await import('@/app/api/public/orders/[token]/claim/route');
    const response = await POST(
      new Request('http://test/api/public/orders/token/claim', { method: 'POST' }),
      context(signOrderToken('order-1')),
    );
    expect(response.status).toBe(401);
    expect(db.prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a tampered tracking token before touching the database', async () => {
    const { POST } = await import('@/app/api/public/orders/[token]/claim/route');
    const response = await POST(
      new Request('http://test/api/public/orders/token/claim', { method: 'POST' }),
      context('order-1.bad'),
    );
    expect(response.status).toBe(404);
    expect(db.prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it('links an unclaimed order and records the shopper audience', async () => {
    db.prisma.order.findUnique.mockResolvedValue({ userId: 'owner-1', shopperId: null });
    db.prisma.order.updateMany.mockResolvedValue({ count: 1 });
    const { POST } = await import('@/app/api/public/orders/[token]/claim/route');
    const response = await POST(
      new Request('http://test/api/public/orders/token/claim', { method: 'POST' }),
      context(signOrderToken('order-1')),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(db.prisma.userAudience.upsert).toHaveBeenCalledWith({
      where: { userId_kind: { userId: 'shopper-1', kind: 'SHOPPER' } },
      create: { userId: 'shopper-1', kind: 'SHOPPER' },
      update: {},
    });
    expect(db.prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', shopperId: null },
      data: { shopperId: 'shopper-1' },
    });
  });

  it('is idempotent when the same shopper opens the link again', async () => {
    db.prisma.order.findUnique.mockResolvedValue({ userId: 'owner-1', shopperId: 'shopper-1' });
    const { POST } = await import('@/app/api/public/orders/[token]/claim/route');
    const response = await POST(
      new Request('http://test/api/public/orders/token/claim', { method: 'POST' }),
      context(signOrderToken('order-1')),
    );

    expect(response.status).toBe(200);
    expect(db.prisma.userAudience.upsert).toHaveBeenCalled();
    expect(db.prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to take an order already saved by another account', async () => {
    db.prisma.order.findUnique.mockResolvedValue({ userId: 'owner-1', shopperId: 'other' });
    const { POST } = await import('@/app/api/public/orders/[token]/claim/route');
    const response = await POST(
      new Request('http://test/api/public/orders/token/claim', { method: 'POST' }),
      context(signOrderToken('order-1')),
    );

    expect(response.status).toBe(409);
    expect(db.prisma.userAudience.upsert).not.toHaveBeenCalled();
  });

  it('refuses to let a shop owner claim their own order', async () => {
    db.prisma.order.findUnique.mockResolvedValue({ userId: 'shopper-1', shopperId: null });
    const { POST } = await import('@/app/api/public/orders/[token]/claim/route');
    const response = await POST(
      new Request('http://test/api/public/orders/token/claim', { method: 'POST' }),
      context(signOrderToken('order-1')),
    );

    expect(response.status).toBe(409);
    expect(db.prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('handles losing a claim race without overwriting the winner', async () => {
    db.prisma.order.findUnique
      .mockResolvedValueOnce({ userId: 'owner-1', shopperId: null })
      .mockResolvedValueOnce({ userId: 'owner-1', shopperId: 'other' });
    db.prisma.order.updateMany.mockResolvedValue({ count: 0 });
    const { POST } = await import('@/app/api/public/orders/[token]/claim/route');
    const response = await POST(
      new Request('http://test/api/public/orders/token/claim', { method: 'POST' }),
      context(signOrderToken('order-1')),
    );

    expect(response.status).toBe(409);
    expect(db.prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', shopperId: null },
      data: { shopperId: 'shopper-1' },
    });
  });
});
