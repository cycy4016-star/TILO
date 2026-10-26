// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  prisma: {
    storeCourier: { findMany: vi.fn() },
    courier: { findUnique: vi.fn() },
    order: { findMany: vi.fn() },
    deliveryOffer: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));
const push = vi.hoisted(() => ({ sendPushToCourier: vi.fn() }));

vi.mock('@/lib/db', () => db);
vi.mock('@/lib/push', () => push);
vi.mock('server-only', () => ({}));

function pendingOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    orderNumber: 'TLZ-1001',
    deliveryFeePesewas: 2500,
    customerLat: 5.61,
    customerLng: -0.18,
    dispatchRadiusKm: 5,
    user: {
      store: {
        id: 'store-1',
        name: 'Ama Threads',
        lat: 5.6037,
        lng: -0.187,
        dispatchRadiusKm: 5,
      },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.storeCourier.findMany.mockResolvedValue([{ storeId: 'store-1' }]);
  db.prisma.courier.findUnique.mockResolvedValue({
    status: 'ACTIVE',
    location: { lat: 5.6037, lng: -0.187, isOnline: true, updatedAt: new Date() },
  });
  db.prisma.order.findMany.mockResolvedValue([pendingOrder()]);
  db.prisma.deliveryOffer.findUnique.mockResolvedValue(null);
  db.prisma.deliveryOffer.upsert.mockResolvedValue({});
  push.sendPushToCourier.mockResolvedValue({ sent: 1, failed: 0, removed: 0 });
});

describe('offerPendingJobsToCourier', () => {
  it('offers waiting orders to a rider when they come on shift', async () => {
    const { offerPendingJobsToCourier } = await import('@/lib/dispatch');
    const result = await offerPendingJobsToCourier('courier-1');

    expect(result).toEqual({ checked: 1, offered: 1 });
    expect(db.prisma.deliveryOffer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ orderId: 'order-1', courierId: 'courier-1' }),
      }),
    );
    expect(push.sendPushToCourier).toHaveBeenCalledWith(
      'courier-1',
      expect.objectContaining({ title: 'New delivery nearby', url: '/courier' }),
    );
  });

  it('does not re-ping an offer that is still live', async () => {
    db.prisma.deliveryOffer.findUnique.mockResolvedValue({
      status: 'OFFERED',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const { offerPendingJobsToCourier } = await import('@/lib/dispatch');
    const result = await offerPendingJobsToCourier('courier-1');

    expect(result).toEqual({ checked: 1, offered: 0 });
    expect(db.prisma.deliveryOffer.upsert).not.toHaveBeenCalled();
    expect(push.sendPushToCourier).not.toHaveBeenCalled();
  });

  it('does not offer an order outside the rider radius', async () => {
    db.prisma.order.findMany.mockResolvedValue([
      pendingOrder({
        user: {
          store: {
            id: 'store-1',
            name: 'Ama Threads',
            lat: 5.6037,
            lng: -0.187,
            dispatchRadiusKm: 5,
          },
        },
        dispatchRadiusKm: 1,
      }),
    ]);
    db.prisma.courier.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      location: { lat: 5.65, lng: -0.18, isOnline: true, updatedAt: new Date() },
    });
    const { offerPendingJobsToCourier } = await import('@/lib/dispatch');
    const result = await offerPendingJobsToCourier('courier-1');

    expect(result).toEqual({ checked: 1, offered: 0 });
    expect(db.prisma.deliveryOffer.upsert).not.toHaveBeenCalled();
  });

  it('returns early when the rider has no active store membership', async () => {
    db.prisma.storeCourier.findMany.mockResolvedValue([]);
    const { offerPendingJobsToCourier } = await import('@/lib/dispatch');
    const result = await offerPendingJobsToCourier('courier-1');

    expect(result).toEqual({ checked: 0, offered: 0 });
    expect(db.prisma.order.findMany).not.toHaveBeenCalled();
  });
});
