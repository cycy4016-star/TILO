// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  prisma: {
    order: { findUnique: vi.fn() },
    store: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/db', () => db);
vi.mock('server-only', () => ({}));

import { signOrderToken } from '@/lib/order-tracking';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ORDER_TRACKING_SECRET = 'route-test-secret';
  db.prisma.order.findUnique.mockResolvedValue({
    orderNumber: 'TILZA-20261022-ABCD1234',
    userId: 'owner-1',
    status: 'PROCESSING',
    fulfillmentMethod: 'DIRECT_PICKUP',
    deliveryStatus: 'NOT_APPLICABLE',
    amountPesewas: 5000,
    createdAt: new Date('2026-10-22T10:00:00.000Z'),
    updatedAt: new Date('2026-10-22T10:05:00.000Z'),
    lines: [{ name: 'Kente scarf', quantity: 2, unitPricePesewas: 2500 }],
  });
  db.prisma.store.findUnique.mockResolvedValue({
    name: 'Adom Fabrics',
    slug: 'adom-fabrics',
    contactPhone: '0244000000',
    address: '12 High Street, Accra',
    lat: 5.556,
    lng: -0.1969,
  });
});

afterEach(() => {
  delete process.env.ORDER_TRACKING_SECRET;
});

describe('public order tracking route', () => {
  it('returns only the buyer-safe order view', async () => {
    const { GET } = await import('@/app/api/public/orders/[token]/route');
    const response = await GET(new Request('http://test/api/public/orders/token'), {
      params: Promise.resolve({ token: signOrderToken('order-1') }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      orderNumber: 'TILZA-20261022-ABCD1234',
      storeName: 'Adom Fabrics',
      status: 'PROCESSING',
      totalPesewas: 5000,
      lines: [{ name: 'Kente scarf', quantity: 2, lineTotalPesewas: 5000 }],
    });
    expect(body).not.toHaveProperty('customer');
    expect(body).not.toHaveProperty('customerPhone');
    expect(body).not.toHaveProperty('customerLat');
    expect(db.prisma.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-1' } }),
    );
  });

  it('does not touch the database for a tampered token', async () => {
    const { GET } = await import('@/app/api/public/orders/[token]/route');
    const response = await GET(new Request('http://test/api/public/orders/token'), {
      params: Promise.resolve({ token: 'order-1.bad' }),
    });

    expect(response.status).toBe(404);
    expect(db.prisma.order.findUnique).not.toHaveBeenCalled();
  });
});
