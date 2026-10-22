// On-shift location heartbeat. Only the newest reading is kept; every ping
// replaces the previous one. This is presence for dispatch, not a tracking
// history.
import 'server-only';

import { NextResponse } from 'next/server';
import { CourierLocationInput } from '@/lib/contracts/courier';
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
    const parsed = CourierLocationInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
    }

    const activeMemberships = await prisma.storeCourier.count({
      where: { courierId: courier.id, status: 'ACTIVE' },
    });
    if (activeMemberships === 0) {
      return NextResponse.json(
        { error: 'A shop still needs to approve you before you can go on shift.' },
        { status: 403 },
      );
    }

    const before = await prisma.courierLocation.findUnique({
      where: { courierId: courier.id },
      select: { isOnline: true },
    });
    await prisma.courierLocation.upsert({
      where: { courierId: courier.id },
      create: {
        courierId: courier.id,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        accuracy: parsed.data.accuracy ?? null,
        isOnline: parsed.data.isOnline,
      },
      update: {
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        accuracy: parsed.data.accuracy ?? null,
        isOnline: parsed.data.isOnline,
      },
    });

    if (parsed.data.isOnline && !before?.isOnline) {
      await prisma.deliveryEvent.create({
        data: {
          courierId: courier.id,
          type: 'ONLINE',
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
