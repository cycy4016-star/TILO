// @vitest-environment node
// The dispatch sweep is time-based recovery, so its tests pin the clock: an
// unaccepted broadcast widens once at 90 seconds and alerts the merchant at two
// minutes. Compare-and-set skips prove two workers cannot both act on one order.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  prisma: {
    order: { findMany: vi.fn(), updateMany: vi.fn() },
    deliveryEvent: { create: vi.fn() },
  },
}));
const dispatch = vi.hoisted(() => ({ dispatchOrder: vi.fn() }));
const notices = vi.hoisted(() => ({
  notify: vi.fn(),
  sendPushToUser: vi.fn(),
}));

vi.mock('@/lib/db', () => db);
vi.mock('@/lib/dispatch', () => dispatch);
vi.mock('@/lib/notify', () => ({ notify: notices.notify }));
vi.mock('@/lib/push', () => ({ sendPushToUser: notices.sendPushToUser }));
vi.mock('server-only', () => ({}));

const NOW = new Date('2026-10-23T12:00:00.000Z');

function order(startedSecondsAgo: number, overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    userId: 'user-1',
    orderNumber: 'TLZ-1001',
    dispatchStartedAt: new Date(NOW.getTime() - startedSecondsAgo * 1000),
    dispatchRadiusKm: 5,
    dispatchWidenedAt: null,
    user: {
      store: { id: 'store-1', name: 'Ama Threads', dispatchRadiusKm: 5 },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.order.findMany.mockResolvedValue([]);
  db.prisma.order.updateMany.mockResolvedValue({ count: 1 });
  db.prisma.deliveryEvent.create.mockResolvedValue({});
  dispatch.dispatchOrder.mockResolvedValue({
    radiusKm: 10,
    offers: 2,
    onlineCouriers: 3,
    handoffCode: '123456',
  });
  notices.notify.mockResolvedValue(undefined);
  notices.sendPushToUser.mockResolvedValue({ sent: 1, failed: 0, removed: 0 });
});

describe('sweepDispatches', () => {
  it('widens a 100-second-old broadcast by 5km with a system event', async () => {
    db.prisma.order.findMany.mockResolvedValue([order(100)]);
    const { sweepDispatches } = await import('@/lib/dispatch-sweep');
    const result = await sweepDispatches(NOW);

    expect(result).toEqual({ checked: 1, widened: 1, fallback: 0, skipped: 0 });
    expect(dispatch.dispatchOrder).toHaveBeenCalledWith('order-1', { radiusKm: 10 });
    expect(db.prisma.deliveryEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        storeId: 'store-1',
        type: 'DISPATCH_WIDENED',
        actorType: 'SYSTEM',
        metadata: expect.objectContaining({ fromRadiusKm: 5, toRadiusKm: 10, offers: 2 }),
      }),
    });
    expect(notices.notify).not.toHaveBeenCalled();
  });

  it('alerts the merchant after two minutes instead of widening again', async () => {
    db.prisma.order.findMany.mockResolvedValue([order(130, { dispatchWidenedAt: new Date() })]);
    const { sweepDispatches } = await import('@/lib/dispatch-sweep');
    const result = await sweepDispatches(NOW);

    expect(result).toEqual({ checked: 1, widened: 0, fallback: 1, skipped: 0 });
    expect(dispatch.dispatchOrder).not.toHaveBeenCalled();
    expect(notices.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        kind: 'DELIVERY_ATTENTION',
        orderId: 'order-1',
      }),
    );
    expect(notices.sendPushToUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        url: '/dashboard/orders',
        tag: 'dispatch-fallback-order-1',
      }),
    );
    expect(db.prisma.deliveryEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'DISPATCH_FALLBACK',
        actorType: 'SYSTEM',
      }),
    });
  });

  it('does nothing when another worker already claimed the order', async () => {
    db.prisma.order.findMany.mockResolvedValue([order(100)]);
    db.prisma.order.updateMany.mockResolvedValue({ count: 0 });
    const { sweepDispatches } = await import('@/lib/dispatch-sweep');
    const result = await sweepDispatches(NOW);

    expect(result).toEqual({ checked: 1, widened: 0, fallback: 0, skipped: 1 });
    expect(dispatch.dispatchOrder).not.toHaveBeenCalled();
    expect(notices.notify).not.toHaveBeenCalled();
  });

  it('marks a ceiling-radius order as widened without re-offering it', async () => {
    db.prisma.order.findMany.mockResolvedValue([order(100, { dispatchRadiusKm: 50 })]);
    const { sweepDispatches } = await import('@/lib/dispatch-sweep');
    const result = await sweepDispatches(NOW);

    expect(result).toEqual({ checked: 1, widened: 0, fallback: 0, skipped: 1 });
    expect(dispatch.dispatchOrder).not.toHaveBeenCalled();
    expect(db.prisma.order.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'order-1', dispatchWidenedAt: null }),
      data: { dispatchWidenedAt: NOW },
    });
  });

  it('skips rows without a start time', async () => {
    db.prisma.order.findMany.mockResolvedValue([order(100, { dispatchStartedAt: null })]);
    const { sweepDispatches } = await import('@/lib/dispatch-sweep');
    const result = await sweepDispatches(NOW);
    expect(result).toEqual({ checked: 1, widened: 0, fallback: 0, skipped: 1 });
    expect(db.prisma.order.updateMany).not.toHaveBeenCalled();
  });
});
