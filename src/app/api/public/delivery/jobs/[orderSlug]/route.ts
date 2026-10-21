// Public rider gig payload. The order number is the capability embedded in the
// merchant-shared link; pickup orders and incomplete spatial data 404.
import 'server-only';

import { NextResponse } from 'next/server';
import { RiderJobResult } from '@/lib/contracts/delivery';
import { prisma } from '@/lib/db';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderSlug: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { orderSlug } = await context.params;
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ orderNumber: orderSlug }, { id: orderSlug }],
        fulfillmentMethod: 'LOCAL_DELIVERY',
      },
      select: {
        orderNumber: true,
        description: true,
        deliveryStatus: true,
        deliveryFeePesewas: true,
        riderId: true,
        customerLat: true,
        customerLng: true,
        user: {
          select: {
            store: { select: { name: true, address: true, lat: true, lng: true } },
          },
        },
      },
    });
    const store = order?.user.store;
    if (
      !order ||
      order.customerLat == null ||
      order.customerLng == null ||
      !store ||
      store.lat == null ||
      store.lng == null
    ) {
      return NextResponse.json({ error: 'Delivery gig not found' }, { status: 404 });
    }

    return NextResponse.json(
      RiderJobResult.parse({
        orderNumber: order.orderNumber,
        description: order.description,
        deliveryStatus: order.deliveryStatus,
        deliveryFeePesewas: order.deliveryFeePesewas,
        riderId: order.riderId,
        store: {
          name: store.name,
          address: store.address,
          lat: store.lat,
          lng: store.lng,
        },
        customer: { lat: order.customerLat, lng: order.customerLng },
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
