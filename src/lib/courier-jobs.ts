// Courier inbox/active-job queries and serialization. Offers deliberately hide
// the buyer's name, phone and exact pin until the rider has accepted.
import 'server-only';

import { type CourierJob, CourierJobs } from '@/lib/contracts/courier';
import { prisma } from '@/lib/db';

type OrderForCourier = {
  id: string;
  orderNumber: string;
  description: string;
  deliveryStatus: 'PENDING_DISPATCH' | 'RIDER_ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED';
  deliveryFeePesewas: number;
  handoffCode: string | null;
  customerLat: number | null;
  customerLng: number | null;
  customer: { name: string; phone: string | null };
  user: {
    store: {
      id: string;
      name: string;
      address: string | null;
      contactPhone: string | null;
      lat: number | null;
      lng: number | null;
    } | null;
  };
};

function toJob(
  order: OrderForCourier,
  options: {
    accepted: boolean;
    distanceKm?: number | null;
    offeredAt?: Date | null;
    acceptedAt?: Date | null;
  },
): CourierJob {
  const store = order.user.store;
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    description: order.description,
    storeName: store?.name ?? 'Shop',
    storeAddress: store?.address ?? null,
    storePhone: store?.contactPhone ?? null,
    storeLat: store?.lat ?? 0,
    storeLng: store?.lng ?? 0,
    customerName: options.accepted ? order.customer.name : null,
    customerPhone: options.accepted ? order.customer.phone : null,
    customerLat: options.accepted ? order.customerLat : null,
    customerLng: options.accepted ? order.customerLng : null,
    deliveryFeePesewas: order.deliveryFeePesewas,
    deliveryStatus: order.deliveryStatus,
    handoffCode: options.accepted ? order.handoffCode : null,
    offeredAt: options.offeredAt ? options.offeredAt.toISOString() : null,
    acceptedAt: options.acceptedAt ? options.acceptedAt.toISOString() : null,
    distanceKm: options.distanceKm ?? null,
  };
}

const orderInclude = {
  customer: { select: { name: true, phone: true } },
  user: {
    select: {
      store: {
        select: {
          id: true,
          name: true,
          address: true,
          contactPhone: true,
          lat: true,
          lng: true,
        },
      },
    },
  },
} as const;

export async function getCourierJobs(courierId: string) {
  await prisma.deliveryOffer.updateMany({
    where: { courierId, status: 'OFFERED', expiresAt: { lte: new Date() } },
    data: { status: 'EXPIRED', respondedAt: new Date() },
  });

  const memberships = await prisma.storeCourier.findMany({
    where: { courierId, status: 'ACTIVE' },
    select: { storeId: true },
  });
  const storeIds = new Set(memberships.map((membership) => membership.storeId));

  const offers = await prisma.deliveryOffer.findMany({
    where: {
      courierId,
      status: 'OFFERED',
      expiresAt: { gt: new Date() },
      order: { deliveryStatus: 'PENDING_DISPATCH' },
    },
    orderBy: { createdAt: 'desc' },
    include: { order: { include: orderInclude } },
  });

  const activeOrders = await prisma.order.findMany({
    where: {
      courierId,
      deliveryStatus: { in: ['RIDER_ASSIGNED', 'IN_TRANSIT', 'DELIVERED'] },
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    include: orderInclude,
  });

  return CourierJobs.parse({
    offers: offers
      .filter((offer) => offer.order.user.store && storeIds.has(offer.order.user.store.id))
      .map((offer) =>
        toJob(offer.order as OrderForCourier, {
          accepted: false,
          distanceKm: offer.distanceKm,
          offeredAt: offer.createdAt,
        }),
      ),
    active: activeOrders
      .filter((order) => order.user.store && storeIds.has(order.user.store.id))
      .map((order) =>
        toJob(order as OrderForCourier, {
          accepted: true,
          acceptedAt: order.updatedAt,
        }),
      ),
  });
}
