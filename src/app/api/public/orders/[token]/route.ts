// Public, account-free order status. The URL token is signed, so it grants
// access to exactly one order and no customer or payment details.
import 'server-only';

import { NextResponse } from 'next/server';
import { PublicOrderTracking } from '@/lib/contracts/public-store';
import { prisma } from '@/lib/db';
import { verifyOrderToken } from '@/lib/order-tracking';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const orderId = verifyOrderToken(token);
    if (!orderId) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        userId: true,
        status: true,
        fulfillmentMethod: true,
        deliveryStatus: true,
        amountPesewas: true,
        handoffCode: true,
        buyerConfirmedAt: true,
        deliveredAt: true,
        courier: {
          select: {
            name: true,
            phone: true,
            vehicleType: true,
            plateNumber: true,
            location: { select: { lat: true, lng: true, updatedAt: true } },
          },
        },
        createdAt: true,
        updatedAt: true,
        lines: {
          orderBy: { createdAt: 'asc' },
          select: { name: true, quantity: true, unitPricePesewas: true },
        },
      },
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const store = await prisma.store.findUnique({
      where: { userId: order.userId },
      select: {
        name: true,
        slug: true,
        contactPhone: true,
        address: true,
        lat: true,
        lng: true,
      },
    });

    return NextResponse.json(
      PublicOrderTracking.parse({
        orderNumber: order.orderNumber,
        storeName: store?.name ?? 'Shop',
        storeSlug: store?.slug ?? '',
        storePhone: store?.contactPhone ?? null,
        storeAddress: store?.address ?? null,
        storeLat: store?.lat ?? null,
        storeLng: store?.lng ?? null,
        status: order.status,
        fulfillmentMethod: order.fulfillmentMethod,
        deliveryStatus: order.deliveryStatus,
        courier: order.courier
          ? {
              name: order.courier.name,
              phone: order.courier.phone,
              vehicleType: order.courier.vehicleType,
              plateNumber: order.courier.plateNumber,
              lat: order.courier.location?.lat ?? null,
              lng: order.courier.location?.lng ?? null,
              lastSeenAt: order.courier.location?.updatedAt.toISOString() ?? null,
            }
          : null,
        handoffCode:
          order.courier && order.deliveryStatus !== 'NOT_APPLICABLE' ? order.handoffCode : null,
        buyerConfirmedAt: order.buyerConfirmedAt?.toISOString() ?? null,
        deliveredAt: order.deliveredAt?.toISOString() ?? null,
        canConfirm: order.deliveryStatus === 'DELIVERED' && order.buyerConfirmedAt == null,
        placedAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        lines: order.lines.map((line) => ({
          name: line.name,
          quantity: line.quantity,
          lineTotalPesewas: line.unitPricePesewas * line.quantity,
        })),
        totalPesewas: order.amountPesewas,
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
