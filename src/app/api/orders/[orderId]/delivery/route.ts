// Merchant delivery detail: rider, handoff state, proof and the append-only
// event trail for one order.
import 'server-only';

import { NextResponse } from 'next/server';
import { MerchantDelivery } from '@/lib/contracts/courier';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { orderId } = await context.params;
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
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
          select: { id: true, marketingConsent: true },
        },
      },
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    const proof = order.deliveryProofs[0];

    return NextResponse.json(
      MerchantDelivery.parse({
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
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
