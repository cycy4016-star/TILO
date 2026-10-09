// @vitest-environment node
//
// Ops center tests: the admin contracts hold their shapes, the new routes stay
// behind the platform-admin gate, and the product velocity math ranks the
// faster seller first.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const gate = vi.hoisted(() => ({ requireAdminUser: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    user: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    store: { count: vi.fn() },
    storeItem: { count: vi.fn(), aggregate: vi.fn() },
    storeCategory: { count: vi.fn() },
    customer: { count: vi.fn(), findMany: vi.fn() },
    order: { count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    orderLineItem: { findMany: vi.fn() },
    smsUsage: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    paymentTransaction: { count: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('@/lib/require-admin-api', () => gate);
vi.mock('@/lib/db', () => db);

beforeEach(() => {
  vi.clearAllMocks();
  gate.requireAdminUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
});

describe('ops contracts', () => {
  it('parses a full overview payload and rejects negative totals', async () => {
    const { AdminOverview } = await import('@/lib/contracts/admin');
    const day = { day: '2026-10-01', signups: 2, orders: 3 };
    expect(
      AdminOverview.safeParse({
        users: 1,
        signupsMonth: 1,
        stores: 1,
        activeStores: 1,
        items: 0,
        customers: 0,
        orders: 0,
        ordersToday: 0,
        unpaidOrders: 0,
        gmvPesewas: 0,
        paidPesewas: 0,
        ordersByStatus: {},
        smsSentMonth: 0,
        smsFailedMonth: 0,
        smsCreditsMonth: 0,
        paymentsPending: 0,
        paymentsSuccess: 0,
        paymentsFailed: 0,
        daily: [day],
      }).success,
    ).toBe(true);
    expect(
      AdminOverview.safeParse({
        users: -1,
        signupsMonth: 0,
        stores: 0,
        activeStores: 0,
        items: 0,
        customers: 0,
        orders: 0,
        ordersToday: 0,
        unpaidOrders: 0,
        gmvPesewas: 0,
        paidPesewas: 0,
        ordersByStatus: {},
        smsSentMonth: 0,
        smsFailedMonth: 0,
        smsCreditsMonth: 0,
        paymentsPending: 0,
        paymentsSuccess: 0,
        paymentsFailed: 0,
        daily: [],
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown event kind', async () => {
    const { OpsEventKind } = await import('@/lib/contracts/admin');
    expect(OpsEventKind.safeParse('order').success).toBe(true);
    expect(OpsEventKind.safeParse('audit-log').success).toBe(false);
  });
});

describe('admin overview route', () => {
  it('returns 403 for a signed-in non-admin', async () => {
    gate.requireAdminUser.mockRejectedValueOnce(
      Response.json({ error: 'Forbidden' }, { status: 403 }),
    );
    const { GET } = await import('@/app/api/admin/overview/route');
    const response = await GET(new Request('http://test/api/admin/overview'));
    expect(response.status).toBe(403);
    expect(db.prisma.user.count).not.toHaveBeenCalled();
  });

  it('returns live totals plus a 14-day series', async () => {
    db.prisma.user.count.mockResolvedValue(4);
    db.prisma.store.count.mockResolvedValue(3);
    db.prisma.storeItem.count.mockResolvedValue(10);
    db.prisma.customer.count.mockResolvedValue(6);
    db.prisma.order.count.mockResolvedValue(9);
    db.prisma.order.aggregate
      .mockResolvedValueOnce({ _sum: { amountPesewas: 50000 } })
      .mockResolvedValueOnce({ _sum: { amountPesewas: 20000 } });
    db.prisma.smsUsage.count.mockResolvedValue(5);
    db.prisma.smsUsage.aggregate.mockResolvedValue({ _sum: { credits: 7 } });
    db.prisma.paymentTransaction.count.mockResolvedValue(1);
    db.prisma.order.groupBy.mockResolvedValue([{ status: 'PENDING', _count: 2 }]);
    db.prisma.user.findMany.mockResolvedValue([{ createdAt: new Date() }]);
    db.prisma.order.findMany.mockResolvedValue([{ createdAt: new Date() }]);

    const { GET } = await import('@/app/api/admin/overview/route');
    const response = await GET(new Request('http://test/api/admin/overview'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users).toBe(4);
    expect(body.gmvPesewas).toBe(50000);
    expect(body.paidPesewas).toBe(20000);
    expect(body.ordersByStatus).toEqual({ PENDING: 2 });
    expect(body.daily).toHaveLength(14);
  });
});

describe('admin shops route', () => {
  it('searches owners, phones, names and slugs', async () => {
    db.prisma.user.findMany.mockResolvedValue([]);
    db.prisma.order.groupBy.mockResolvedValue([]);
    const { GET } = await import('@/app/api/admin/shops/route');
    const response = await GET(new Request('http://test/api/admin/shops?q=ama'));
    expect(response.status).toBe(200);
    expect(db.prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: expect.arrayContaining([
            { name: { contains: 'ama', mode: 'insensitive' } },
            { phoneNumber: { contains: 'ama', mode: 'insensitive' } },
          ]),
        },
      }),
    );
    await expect(response.json()).resolves.toEqual({ shops: [], total: 0 });
  });
});

describe('admin product velocity', () => {
  it('ranks the faster seller first with units per day', async () => {
    const slow = new Date('2026-09-01T10:00:00.000Z');
    const fastDay = new Date('2026-10-01T10:00:00.000Z');
    db.prisma.orderLineItem.findMany.mockResolvedValue([
      {
        name: 'Slow apron',
        quantity: 10,
        unitPricePesewas: 1000,
        unitCostPesewas: 400,
        orderId: 'o-1',
        createdAt: slow,
        storeItem: {
          id: 's-1',
          stock: 3,
          active: true,
          store: { name: 'Shop A', slug: 'a', userId: 'u-1' },
        },
        order: { userId: 'u-1' },
      },
      {
        name: 'Slow apron',
        quantity: 10,
        unitPricePesewas: 1000,
        unitCostPesewas: 400,
        orderId: 'o-2',
        createdAt: fastDay,
        storeItem: {
          id: 's-1',
          stock: 3,
          active: true,
          store: { name: 'Shop A', slug: 'a', userId: 'u-1' },
        },
        order: { userId: 'u-1' },
      },
      {
        name: 'Fast scarf',
        quantity: 10,
        unitPricePesewas: 2000,
        unitCostPesewas: null,
        orderId: 'o-3',
        createdAt: fastDay,
        storeItem: {
          id: 's-2',
          stock: null,
          active: true,
          store: { name: 'Shop B', slug: 'b', userId: 'u-2' },
        },
        order: { userId: 'u-2' },
      },
    ]);
    db.prisma.storeItem.aggregate.mockResolvedValue({ _count: 0 });
    db.prisma.storeItem.count.mockResolvedValue(0);

    const { GET } = await import('@/app/api/admin/products/route');
    const response = await GET(new Request('http://test/api/admin/products'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items[0].name).toBe('Fast scarf');
    expect(body.items[0].unitsPerDay).toBe(10);
    expect(body.items[1].name).toBe('Slow apron');
    expect(body.items[1].unitsPerDay).toBeLessThan(1);
    expect(body.totalUnits).toBe(30);
  });
});

describe('admin events route', () => {
  it('filters the stream by text and source', async () => {
    db.prisma.order.findMany.mockResolvedValue([
      {
        id: 'o-1',
        orderNumber: 'TILO-1',
        description: '1x Apron',
        status: 'PENDING',
        amountPesewas: 1000,
        paidAt: null,
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
        customer: { name: 'Ama' },
        user: { name: 'Owner', store: { name: 'Shop A' } },
      },
    ]);
    db.prisma.smsUsage.findMany.mockResolvedValue([
      {
        id: 's-1',
        to: '+233240000000',
        source: 'OTP',
        provider: 'bms',
        ok: false,
        error: 'BMS 402: no credit',
        credits: 1,
        createdAt: new Date('2026-10-02T10:00:00.000Z'),
      },
    ]);
    db.prisma.paymentTransaction.findMany.mockResolvedValue([]);
    db.prisma.user.findMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/admin/events/route');
    const failures = await GET(new Request('http://test/api/admin/events?q=402&kind=sms'));
    expect(failures.status).toBe(200);
    const failed = await failures.json();
    expect(failed.events).toHaveLength(1);
    expect(failed.events[0].kind).toBe('sms');

    const orders = await GET(new Request('http://test/api/admin/events?kind=order'));
    expect((await orders.json()).events.map((e: { kind: string }) => e.kind)).toEqual(['order']);
  });
});

describe('admin dossier route', () => {
  it('404s an unknown account and stays gated', async () => {
    gate.requireAdminUser.mockRejectedValueOnce(
      Response.json({ error: 'Forbidden' }, { status: 403 }),
    );
    const { GET } = await import('@/app/api/admin/shops/[userId]/route');
    const forbidden = await GET(new Request('http://test/api/admin/shops/u-9'), {
      params: Promise.resolve({ userId: 'u-9' }),
    });
    expect(forbidden.status).toBe(403);

    db.prisma.user.findUnique.mockResolvedValue(null);
    const missing = await GET(new Request('http://test/api/admin/shops/u-9'), {
      params: Promise.resolve({ userId: 'u-9' }),
    });
    expect(missing.status).toBe(404);
  });
});
