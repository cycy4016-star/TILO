import { NextResponse } from 'next/server';
import { CourierAcceptResult } from '@/lib/contracts/courier';
import { requireCourier } from '@/lib/courier-auth';
import { prisma } from '@/lib/db';
import { newHandoffCode } from '@/lib/dispatch';
import { signOrderToken } from '@/lib/order-tracking';
import { sendPushToOrder, sendPushToUser } from '@/lib/push';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

class ClaimRaceError extends Error {}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { courier } = await requireCourier(request);
    const { orderId } = await context.params;

    const offer = await prisma.deliveryOffer.findUnique({
      where: { orderId_courierId: { orderId, courierId: courier.id } },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            userId: true,
            deliveryStatus: true,
            handoffCode: true,
            user: { select: { store: { select: { id: true } } } },
          },
        },
      },
    });
    if (!offer)
      return NextResponse.json({ error: 'This job is not offered to you' }, { status: 404 });
    if (offer.status !== 'OFFERED' || offer.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'This offer has expired' }, { status: 410 });
    }
    if (offer.order.deliveryStatus !== 'PENDING_DISPATCH') {
      return NextResponse.json({ error: 'Another rider just accepted this gig' }, { status: 409 });
    }

    const membership = await prisma.storeCourier.findFirst({
      where: {
        courierId: courier.id,
        status: 'ACTIVE',
        storeId: offer.order.user.store?.id ?? '',
      },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json({ error: 'This shop has not approved you' }, { status: 403 });
    }

    const handoffCode = offer.order.handoffCode ?? newHandoffCode();
    const now = new Date();
    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: offer.order.id, deliveryStatus: 'PENDING_DISPATCH' },
          data: {
            deliveryStatus: 'RIDER_ASSIGNED',
            courierId: courier.id,
            riderId: `${courier.name} · ${courier.phone}`,
            handoffCode,
          },
        });
        if (claimed.count === 0) throw new ClaimRaceError();

        await tx.deliveryOffer.update({
          where: { id: offer.id },
          data: { status: 'ACCEPTED', respondedAt: now },
        });
        await tx.deliveryOffer.updateMany({
          where: { orderId: offer.order.id, id: { not: offer.id }, status: 'OFFERED' },
          data: { status: 'EXPIRED', respondedAt: now },
        });
        await tx.deliveryEvent.create({
          data: {
            orderId: offer.order.id,
            storeId: offer.order.user.store?.id,
            courierId: courier.id,
            type: 'ACCEPTED',
            actorType: 'COURIER',
            actorId: courier.id,
          },
        });
      });
    } catch (error) {
      if (error instanceof ClaimRaceError) {
        return NextResponse.json(
          { error: 'Another rider just accepted this gig' },
          { status: 409 },
        );
      }
      throw error;
    }

    await Promise.all([
      sendPushToOrder(offer.order.id, {
        title: 'Rider assigned',
        body: `${courier.name} is coming to collect your delivery.`,
        url: `/track/${signOrderToken(offer.order.id)}`,
        tag: `order-${offer.order.id}`,
      }),
      sendPushToUser(offer.order.userId, {
        title: 'Rider accepted a delivery',
        body: `${courier.name} is handling #${offer.order.orderNumber}.`,
        url: '/dashboard/orders',
        tag: `order-${offer.order.id}`,
      }),
    ]);

    return NextResponse.json(
      CourierAcceptResult.parse({
        ok: true,
        orderId: offer.order.id,
        deliveryStatus: 'RIDER_ASSIGNED',
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
