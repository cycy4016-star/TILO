// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  prisma: {
    order: { findUnique: vi.fn(), update: vi.fn() },
    storeCourier: { findMany: vi.fn() },
    deliveryEvent: { create: vi.fn() },
    deliveryOffer: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));
const push = vi.hoisted(() => ({ sendPushToCourier: vi.fn() }));

vi.mock('@/lib/db', () => db);
vi.mock('@/lib/push', () => push);
vi.mock('server-only', () => ({}));

const store = {
  id: 'store-1',
  name: 'Ama Threads',
  lat: 5.6037,
  lng: -0.187,
  dispatchRadiusKm: 5,
};

const baseOrder = {
  id: 'order-1',
  orderNumber: 'TLZ-1001',
  deliveryStatus: 'NOT_APPLICABLE',
  fulfillmentMethod: 'LOCAL_DELIVERY',
  deliveryFeePesewas: 2500,
  customerLat: 5.61,
  customerLng: -0.18,
  handoffCode: null,
  user: { store },
};

function member(id: string, lat: number, lng: number, minutesAgo: number, isOnline = true) {
  return {
    courier: {
      id,
      name: id,
      location: {
        lat,
        lng,
        isOnline,
        updatedAt: new Date(Date.now() - minutesAgo * 60_000),
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  db.prisma.order.findUnique.mockResolvedValue(baseOrder);
  db.prisma.order.update.mockResolvedValue({});
  db.prisma.storeCourier.findMany.mockResolvedValue([]);
  db.prisma.deliveryEvent.create.mockResolvedValue({});
  db.prisma.deliveryOffer.findUnique.mockResolvedValue(null);
  db.prisma.deliveryOffer.upsert.mockResolvedValue({});
  push.sendPushToCourier.mockResolvedValue({ sent: 1, failed: 0, removed: 0 });
});

describe('dispatchOrder', () => {
  it('rejects pickup orders before touching delivery state', async () => {
    db.prisma.order.findUnique.mockResolvedValue({
      ...baseOrder,
      fulfillmentMethod: 'DIRECT_PICKUP',
    });
    const { dispatchOrder, DispatchError } = await import('@/lib/dispatch');
    await expect(dispatchOrder('order-1')).rejects.toBeInstanceOf(DispatchError);
    expect(db.prisma.order.update).not.toHaveBeenCalled();
    expect(db.prisma.deliveryOffer.upsert).not.toHaveBeenCalled();
  });

  it('offers only to fresh, online, in-radius riders and keeps the handoff code', async () => {
    db.prisma.order.findUnique.mockResolvedValue({ ...baseOrder, handoffCode: '123456' });
    db.prisma.storeCourier.findMany.mockResolvedValue([
      member('near', 5.605, -0.185, 2),
      member('far', 5.68, -0.18, 2),
      member('offline', 5.605, -0.185, 2, false),
      member('stale', 5.605, -0.185, 45),
    ]);
    const { dispatchOrder } = await import('@/lib/dispatch');
    const result = await dispatchOrder('order-1');

    expect(result).toMatchObject({
      offers: 1,
      onlineCouriers: 2,
      radiusKm: 5,
      handoffCode: '123456',
    });
    expect(db.prisma.deliveryOffer.upsert).toHaveBeenCalledTimes(1);
    expect(db.prisma.deliveryOffer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ courierId: 'near', status: 'OFFERED' }),
      }),
    );
    expect(push.sendPushToCourier).toHaveBeenCalledWith(
      'near',
      expect.objectContaining({ title: 'New delivery nearby', url: '/courier' }),
    );
    expect(db.prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { deliveryStatus: 'PENDING_DISPATCH', handoffCode: '123456' },
    });
  });

  it('returns zero offers without failing when nobody is online', async () => {
    db.prisma.storeCourier.findMany.mockResolvedValue([member('offline', 5.605, -0.185, 2, false)]);
    const { dispatchOrder } = await import('@/lib/dispatch');
    const result = await dispatchOrder('order-1');
    expect(result.offers).toBe(0);
    expect(result.onlineCouriers).toBe(0);
    expect(push.sendPushToCourier).not.toHaveBeenCalled();
    expect(db.prisma.deliveryOffer.upsert).not.toHaveBeenCalled();
  });

  it('generates a six-digit handoff code when the order has none', async () => {
    const { dispatchOrder } = await import('@/lib/dispatch');
    const result = await dispatchOrder('order-1');
    expect(result.handoffCode).toMatch(/^\d{6}$/);
  });

  it('clamps an explicit radius to the supported range', async () => {
    const { dispatchOrder } = await import('@/lib/dispatch');
    expect((await dispatchOrder('order-1', { radiusKm: 0 })).radiusKm).toBe(1);
    expect((await dispatchOrder('order-1', { radiusKm: 500 })).radiusKm).toBe(50);
  });
});
