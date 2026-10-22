// Go off shift without discarding the last known position. Dispatch excludes
// offline riders immediately.
import 'server-only';

import { NextResponse } from 'next/server';
import { CourierPresenceInput } from '@/lib/contracts/courier';
import { requireCourier } from '@/lib/courier-auth';
import { prisma } from '@/lib/db';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { courier } = await requireCourier(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    const parsed = CourierPresenceInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid presence update' }, { status: 400 });
    }

    const before = await prisma.courierLocation.findUnique({
      where: { courierId: courier.id },
      select: { isOnline: true },
    });
    if (parsed.data.isOnline && !before) {
      return NextResponse.json(
        { error: 'Share your location before going on shift.' },
        { status: 400 },
      );
    }

    await prisma.courierLocation.updateMany({
      where: { courierId: courier.id },
      data: { isOnline: parsed.data.isOnline },
    });

    if (before?.isOnline && !parsed.data.isOnline) {
      await prisma.deliveryEvent.create({
        data: {
          courierId: courier.id,
          type: 'OFFLINE',
          actorType: 'COURIER',
          actorId: courier.id,
        },
      });
    }

    return NextResponse.json({ ok: true, isOnline: parsed.data.isOnline });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
