// Active assignments for the merchant delivery desk: rider, proof, buyer
// confirmation and the verify action all in one compact list.
import 'server-only';

import { NextResponse } from 'next/server';
import { CrewDeliveryList } from '@/lib/contracts/courier';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
        fulfillmentMethod: 'LOCAL_DELIVERY',
        deliveryStatus: { in: ['RIDER_ASSIGNED', 'IN_TRANSIT', 'DELIVERED'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 15,
      select: {
        id: true,
        orderNumber: true,
        deliveryStatus: true,
        handoffCode: true,
        handoffCodeUsedAt: true,
        buyerConfirmedAt: true,
        merchantVerifiedAt: true,
        deliveredAt: true,
        courier: { select: { name: true, phone: true } },
        deliveryEvents: { orderBy: { createdAt: 'asc' } },
        deliveryProofs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { marketingConsent: true },
        },
      },
    });

    return NextResponse.json(
      CrewDeliveryList.parse({
        items: orders.map((order) => {
          const proof = order.deliveryProofs[0];
          return {
            orderId: order.id,
            orderNumber: order.orderNumber,
            deliveryStatus: order.deliveryStatus,
            courierName: order.courier?.name ?? null,
            courierPhone: order.courier?.phone ?? null,
            handoffCode: order.handoffCode,
            handoffCodeUsedAt: order.handoffCodeUsedAt?.toISOString() ?? null,
            buyerConfirmedAt: order.buyerConfirmedAt?.toISOString() ?? null,
            merchantVerifiedAt: order.merchantVerifiedAt?.toISOString() ?? null,
            deliveredAt: order.deliveredAt?.toISOString() ?? null,
            events: order.deliveryEvents.map((event) => ({
              id: event.id,
              type: event.type,
              actorType: event.actorType,
              actorId: event.actorId,
              note: event.note,
              createdAt: event.createdAt.toISOString(),
            })),
            proofUrl: proof ? `/api/orders/${order.id}/proof` : null,
            proofConsent: proof?.marketingConsent ?? false,
          };
        }),
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
