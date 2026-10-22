// Courier lifecycle updates after acceptance. Only the assigned rider can move
// the order; the buyer confirms separately with the handoff code + photo.
import 'server-only';

import { NextResponse } from 'next/server';
import { CourierJobStatusInput, CourierStatusResult } from '@/lib/contracts/courier';
import { requireCourier } from '@/lib/courier-auth';
import { prisma } from '@/lib/db';
import { signOrderToken } from '@/lib/order-tracking';
import { sendPushToOrder, sendPushToUser } from '@/lib/push';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { courier } = await requireCourier(request);
    const { orderId } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    const parsed = CourierJobStatusInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid delivery status' }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, courierId: courier.id },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        deliveryStatus: true,
        handoffCode: true,
        user: { select: { store: { select: { id: true } } } },
      },
    });
    if (!order) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });

    const next = parsed.data.status;
    if (order.deliveryStatus === next) {
      return NextResponse.json(CourierStatusResult.parse({ ok: true, deliveryStatus: next }));
    }
    if (order.deliveryStatus === 'DELIVERED') {
      return NextResponse.json({ error: 'This delivery is already complete' }, { status: 409 });
    }
    if (next === 'IN_TRANSIT' && order.deliveryStatus !== 'RIDER_ASSIGNED') {
      return NextResponse.json({ error: 'Accept the job before picking it up' }, { status: 409 });
    }
    if (next === 'DELIVERED' && order.deliveryStatus !== 'IN_TRANSIT') {
      return NextResponse.json({ error: 'Mark the pickup before delivery' }, { status: 409 });
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          deliveryStatus: next,
          deliveredAt: next === 'DELIVERED' ? now : undefined,
        },
      }),
      prisma.deliveryEvent.create({
        data: {
          orderId: order.id,
          storeId: order.user.store?.id,
          courierId: courier.id,
          type: next === 'IN_TRANSIT' ? 'PICKED_UP' : 'DELIVERED',
          actorType: 'COURIER',
          actorId: courier.id,
          note: parsed.data.note ?? null,
        },
      }),
    ]);

    const trackingUrl = `/track/${signOrderToken(order.id)}`;
    await Promise.all([
      sendPushToOrder(order.id, {
        title: next === 'IN_TRANSIT' ? 'Your order is on the way' : 'Your order was delivered',
        body:
          next === 'IN_TRANSIT'
            ? `${courier.name} picked up #${order.orderNumber}.`
            : `Show the handoff code on your tracking page to confirm receipt.`,
        url: trackingUrl,
        tag: `order-${order.id}`,
      }),
      sendPushToUser(order.userId, {
        title: next === 'IN_TRANSIT' ? 'Order picked up' : 'Order delivered',
        body: `${courier.name} · #${order.orderNumber}`,
        url: '/dashboard/delivery',
        tag: `order-${order.id}`,
      }),
    ]);

    return NextResponse.json(CourierStatusResult.parse({ ok: true, deliveryStatus: next }));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
