// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  prisma: {
    store: { findUnique: vi.fn() },
    storefrontView: { findMany: vi.fn() },
    order: { findMany: vi.fn() },
    customer: { count: vi.fn() },
  },
}));
const auth = vi.hoisted(() => ({ requireAuth: vi.fn() }));

vi.mock('@/lib/db', () => db);
vi.mock('@/lib/require-auth', () => auth);
vi.mock('server-only', () => ({}));

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.store.findUnique.mockResolvedValue({ id: 'store-1' });
  auth.requireAuth.mockResolvedValue({ id: 'owner-1' });
  db.prisma.customer.count.mockResolvedValue(1);
});

describe('storefront analytics route', () => {
  it('counts views, unique visitors, sources, orders and revenue', async () => {
    const now = new Date();
    db.prisma.storefrontView.findMany.mockResolvedValue([
      {
        visitorId: 'visitor-a',
        ref: 'whatsapp',
        referrerHost: null,
        createdAt: now,
      },
      {
        visitorId: 'visitor-a',
        ref: null,
        referrerHost: 'instagram.com',
        createdAt: now,
      },
      {
        visitorId: 'visitor-b',
        ref: null,
        referrerHost: null,
        createdAt: now,
      },
    ]);
    db.prisma.order.findMany.mockResolvedValue([
      { createdAt: now, amountPesewas: 5000, status: 'PENDING' },
      { createdAt: now, amountPesewas: 9000, status: 'CANCELLED' },
    ]);

    const { GET } = await import('@/app/api/dashboard/analytics/route');
    const response = await GET(new Request('https://tilza.app/api/dashboard/analytics?days=7'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      days: 7,
      views: 3,
      visitors: 2,
      storefrontOrders: 2,
      storefrontRevenuePesewas: 5000,
      leads: 1,
      conversionRate: 100,
    });
    expect(body.sources).toHaveLength(3);
    expect(body.sources).toEqual(
      expect.arrayContaining([
        { source: 'Direct', views: 1 },
        { source: 'instagram.com', views: 1 },
        { source: 'whatsapp', views: 1 },
      ]),
    );
    expect(body.daily.reduce((sum: number, day: { views: number }) => sum + day.views, 0)).toBe(3);
  });

  it('returns 404 when the signed-in account has no store', async () => {
    db.prisma.store.findUnique.mockResolvedValue(null);
    const { GET } = await import('@/app/api/dashboard/analytics/route');
    const response = await GET(new Request('https://tilza.app/api/dashboard/analytics'));

    expect(response.status).toBe(404);
    expect(db.prisma.storefrontView.findMany).not.toHaveBeenCalled();
  });
});
