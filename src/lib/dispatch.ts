// Dispatch one local-delivery order to the merchant's own approved, online
// crew. The order row is the single source of truth: offers are an inbox and
// audit convenience, while the courier accept route still does a compare-and-set
// on the order so two riders can never both win.
import 'server-only';

import { prisma } from '@/lib/db';
import { haversineDistanceKm } from '@/lib/delivery';
import { sendPushToCourier } from '@/lib/push';

const ONLINE_WINDOW_MS = 30 * 60 * 1000;
const OFFER_TTL_MS = 5 * 60 * 1000;

export class DispatchError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'DispatchError';
    this.status = status;
  }
}

export function newHandoffCode(): string {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return (value % 1_000_000).toString().padStart(6, '0');
}

export type DispatchOutcome = {
  offers: number;
  onlineCouriers: number;
  radiusKm: number;
  handoffCode: string;
};

export async function dispatchOrder(
  orderId: string,
  options?: { radiusKm?: number; restart?: boolean },
): Promise<DispatchOutcome> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      deliveryStatus: true,
      fulfillmentMethod: true,
      deliveryFeePesewas: true,
      customerLat: true,
      customerLng: true,
      handoffCode: true,
      dispatchStartedAt: true,
      user: {
        select: {
          store: {
            select: {
              id: true,
              name: true,
              lat: true,
              lng: true,
              dispatchRadiusKm: true,
            },
          },
        },
      },
    },
  });
  const store = order?.user.store;
  if (!order || !store) throw new DispatchError('Order not found', 404);
  if (order.fulfillmentMethod !== 'LOCAL_DELIVERY') {
    throw new DispatchError('This order is for pickup — there is no delivery to dispatch.');
  }
  if (order.customerLat == null || order.customerLng == null) {
    throw new DispatchError('This order has no pinned delivery entrance.');
  }
  if (store.lat == null || store.lng == null) {
    throw new DispatchError('Set the shop pickup pin before dispatching deliveries.');
  }
  if (order.deliveryStatus !== 'NOT_APPLICABLE' && order.deliveryStatus !== 'PENDING_DISPATCH') {
    throw new DispatchError('This delivery already has a rider.', 409);
  }

  const radiusKm = Math.min(50, Math.max(1, options?.radiusKm ?? store.dispatchRadiusKm ?? 5));
  const handoffCode = order.handoffCode ?? newHandoffCode();
  const now = new Date();

  await prisma.order.update({
    where: { id: order.id },
    data: {
      deliveryStatus: 'PENDING_DISPATCH',
      handoffCode,
      dispatchRadiusKm: radiusKm,
      // A merchant broadcast/retry starts a fresh 90s/2min clock. Automatic
      // re-dispatch from the sweep keeps the original clock.
      dispatchStartedAt: options?.restart || !order.dispatchStartedAt ? now : undefined,
      dispatchWidenedAt: options?.restart ? null : undefined,
      dispatchFallbackAt: options?.restart ? null : undefined,
    },
  });

  const memberships = await prisma.storeCourier.findMany({
    where: { storeId: store.id, status: 'ACTIVE', courier: { status: 'ACTIVE' } },
    select: {
      courier: {
        select: {
          id: true,
          name: true,
          location: { select: { lat: true, lng: true, isOnline: true, updatedAt: true } },
        },
      },
    },
  });

  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  const online = memberships.filter((membership) => {
    const location = membership.courier.location;
    return Boolean(location?.isOnline && location.updatedAt.getTime() >= cutoff);
  });
  const candidates = online
    .flatMap((membership) => {
      const location = membership.courier.location;
      if (!location) return [];
      const distanceKm = haversineDistanceKm(
        store.lat as number,
        store.lng as number,
        location.lat,
        location.lng,
      );
      return distanceKm <= radiusKm ? [{ courier: membership.courier, location, distanceKm }] : [];
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  await prisma.deliveryEvent.create({
    data: {
      orderId: order.id,
      storeId: store.id,
      type: 'DISPATCHED',
      actorType: 'SYSTEM',
      metadata: {
        radiusKm,
        onlineCouriers: online.length,
        offers: candidates.length,
      },
    },
  });

  const expiresAt = new Date(Date.now() + OFFER_TTL_MS);
  let offers = 0;
  for (const candidate of candidates) {
    const existing = await prisma.deliveryOffer.findUnique({
      where: {
        orderId_courierId: { orderId: order.id, courierId: candidate.courier.id },
      },
    });
    if (existing?.status === 'ACCEPTED') continue;

    await prisma.deliveryOffer.upsert({
      where: {
        orderId_courierId: { orderId: order.id, courierId: candidate.courier.id },
      },
      create: {
        orderId: order.id,
        courierId: candidate.courier.id,
        status: 'OFFERED',
        distanceKm: candidate.distanceKm,
        expiresAt,
      },
      update: {
        status: 'OFFERED',
        distanceKm: candidate.distanceKm,
        expiresAt,
        respondedAt: null,
      },
    });
    offers += 1;

    await sendPushToCourier(candidate.courier.id, {
      title: 'New delivery nearby',
      body: `${store.name} — ${(order.deliveryFeePesewas / 100).toFixed(2)} GHS · ${candidate.distanceKm.toFixed(1)} km away`,
      url: '/courier',
      tag: `dispatch-${order.id}`,
    });
  }

  return {
    offers,
    onlineCouriers: online.length,
    radiusKm,
    handoffCode,
  };
}
