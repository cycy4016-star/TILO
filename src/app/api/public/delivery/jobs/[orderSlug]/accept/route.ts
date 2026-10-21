// Public rider gig acceptance. No rider accounts: the rider supplies a
// name/phone identity, and the write is guarded by a compare-and-set on
// PENDING_DISPATCH so two riders racing for the same job cannot both win.
import 'server-only';

import { NextResponse } from 'next/server';
import { DeliveryAccept, DeliveryAcceptResult } from '@/lib/contracts/delivery';
import { prisma } from '@/lib/db';
import { deliveryDirectionsUrl } from '@/lib/delivery';
import { allow, ipOf } from '@/lib/rate-limit';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderSlug: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    if (!allow(`${ipOf(request)}:delivery-accept`)) {
      return NextResponse.json(
        { error: 'Too many attempts from this address — slow down' },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = DeliveryAccept.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { errors: { riderId: parsed.error.errors[0]?.message ?? 'Tell us who you are' } },
        { status: 400 },
      );
    }

    const { orderSlug } = await context.params;
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ orderNumber: orderSlug }, { id: orderSlug }],
        fulfillmentMethod: 'LOCAL_DELIVERY',
      },
      select: {
        id: true,
        deliveryStatus: true,
        riderId: true,
        customerLat: true,
        customerLng: true,
        user: { select: { store: { select: { lat: true, lng: true } } } },
      },
    });
    const shopLat = order?.user.store?.lat;
    const shopLng = order?.user.store?.lng;
    if (
      !order ||
      order.customerLat == null ||
      order.customerLng == null ||
      shopLat == null ||
      shopLng == null
    ) {
      return NextResponse.json({ error: 'Delivery gig not found' }, { status: 404 });
    }

    const directionsUrl = deliveryDirectionsUrl(
      shopLat,
      shopLng,
      order.customerLat,
      order.customerLng,
    );

    // Refreshing the page after accepting is harmless for the rider who won.
    if (order.deliveryStatus === 'RIDER_ASSIGNED' && order.riderId === parsed.data.riderId) {
      return NextResponse.json(
        DeliveryAcceptResult.parse({
          ok: true,
          deliveryStatus: order.deliveryStatus,
          riderId: order.riderId,
          directionsUrl,
        }),
      );
    }
    if (order.deliveryStatus !== 'PENDING_DISPATCH') {
      return NextResponse.json(
        {
          error:
            order.deliveryStatus === 'RIDER_ASSIGNED'
              ? 'Another rider just accepted this gig'
              : 'This delivery is not open for acceptance right now',
        },
        { status: 409 },
      );
    }

    // Atomic claim: only one rider can move PENDING_DISPATCH -> RIDER_ASSIGNED.
    const claimed = await prisma.order.updateMany({
      where: { id: order.id, deliveryStatus: 'PENDING_DISPATCH' },
      data: { deliveryStatus: 'RIDER_ASSIGNED', riderId: parsed.data.riderId },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: 'Another rider just accepted this gig' }, { status: 409 });
    }

    return NextResponse.json(
      DeliveryAcceptResult.parse({
        ok: true,
        deliveryStatus: 'RIDER_ASSIGNED',
        riderId: parsed.data.riderId,
        directionsUrl,
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
