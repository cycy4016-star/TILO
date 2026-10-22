// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const digest = vi.hoisted(() => ({ sendWeeklyDigest: vi.fn() }));
const push = vi.hoisted(() => ({ sendPushToUser: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    store: { findMany: vi.fn() },
    order: { findMany: vi.fn() },
    customer: { count: vi.fn() },
    storeItem: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/merchant-alerts', () => digest);
vi.mock('@/lib/push', () => push);
vi.mock('@/lib/db', () => db);
vi.mock('server-only', () => ({}));

const storeWithEmail = {
  id: 'store-1',
  name: 'Kente Kitchen',
  userId: 'owner-1',
  user: { email: 'owner@example.test', name: 'Ama' },
};

const storeWithoutEmail = {
  id: 'store-2',
  name: 'No Email Shop',
  userId: 'owner-2',
  user: { email: null, name: 'Kofi' },
};

function request(secret?: string) {
  return new Request('http://test/api/cron/weekly-digest', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
  digest.sendWeeklyDigest.mockResolvedValue(true);
  push.sendPushToUser.mockResolvedValue({ sent: 1, failed: 0, removed: 0 });
  db.prisma.store.findMany.mockResolvedValue([storeWithEmail, storeWithoutEmail]);
  db.prisma.order.findMany.mockResolvedValue([{ amountPesewas: 3200 }, { amountPesewas: 1800 }]);
  db.prisma.customer.count.mockResolvedValue(3);
  db.prisma.storeItem.findMany.mockResolvedValue([{ name: 'Kente scarf', stock: 1 }]);
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('weekly digest route', () => {
  it('refuses to run until a cron secret is configured', async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await import('@/app/api/cron/weekly-digest/route');
    const response = await POST(request('anything'));
    expect(response.status).toBe(503);
    expect(db.prisma.store.findMany).not.toHaveBeenCalled();
  });

  it('rejects a request without the shared secret', async () => {
    const { POST } = await import('@/app/api/cron/weekly-digest/route');
    const response = await POST(request('wrong-secret'));
    expect(response.status).toBe(401);
    expect(db.prisma.store.findMany).not.toHaveBeenCalled();
  });

  it('sends one email per shop that has an owner address', async () => {
    const { POST } = await import('@/app/api/cron/weekly-digest/route');
    const response = await POST(request('test-cron-secret'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, stores: 2, sent: 1 });

    expect(db.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'owner-1', status: { not: 'CANCELLED' } }),
      }),
    );
    expect(db.prisma.customer.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'owner-1' }) }),
    );
    expect(digest.sendWeeklyDigest).toHaveBeenCalledWith({
      to: 'owner@example.test',
      ownerName: 'Ama',
      storeName: 'Kente Kitchen',
      orderCount: 2,
      revenuePesewas: 5000,
      newCustomers: 3,
      lowStock: [{ name: 'Kente scarf', stock: 1 }],
    });
    expect(push.sendPushToUser).toHaveBeenCalledTimes(2);
    expect(push.sendPushToUser).toHaveBeenCalledWith('owner-1', {
      title: 'Your week at Kente Kitchen',
      body: '2 orders · GH₵ 50.00 · 3 new customers · 1 low stock',
      url: '/dashboard',
      tag: 'weekly-digest-store-1',
    });
    expect(push.sendPushToUser).toHaveBeenCalledWith('owner-2', {
      title: 'Your week at No Email Shop',
      body: '2 orders · GH₵ 50.00 · 3 new customers · 1 low stock',
      url: '/dashboard',
      tag: 'weekly-digest-store-2',
    });
  });

  it('pushes to owners who have not set an email address', async () => {
    db.prisma.store.findMany.mockResolvedValue([storeWithoutEmail]);
    const { POST } = await import('@/app/api/cron/weekly-digest/route');
    const response = await POST(request('test-cron-secret'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, stores: 1, sent: 0 });
    expect(digest.sendWeeklyDigest).not.toHaveBeenCalled();
    expect(push.sendPushToUser).toHaveBeenCalledWith(
      'owner-2',
      expect.objectContaining({ title: 'Your week at No Email Shop' }),
    );
  });
});
