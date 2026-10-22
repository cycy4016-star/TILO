// Courier push registration. The invite-scoped cookie identifies the rider and
// the subscription is stored against the Courier row, not a merchant User.
import 'server-only';

import { NextResponse } from 'next/server';
import {
  PushEndpointInput,
  PushSubscribeResult,
  PushSubscriptionInput,
} from '@/lib/contracts/push';
import { SimplePushConfig } from '@/lib/contracts/simple-push';
import { requireCourier } from '@/lib/courier-auth';
import { prisma } from '@/lib/db';
import { isPushConfigured } from '@/lib/push';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { courier } = await requireCourier(request);
    const configured = isPushConfigured();
    const deviceCount = configured
      ? await prisma.courierPushSubscription.count({ where: { courierId: courier.id } })
      : 0;
    return NextResponse.json(
      SimplePushConfig.parse({
        configured,
        publicKey: configured ? (process.env.VAPID_PUBLIC_KEY ?? null) : null,
        subscribed: deviceCount > 0,
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const { courier } = await requireCourier(request);
    if (!isPushConfigured()) {
      return NextResponse.json({ error: 'Web Push is not configured' }, { status: 503 });
    }
    const parsed = PushSubscriptionInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 });
    }
    const input = parsed.data;
    await prisma.courierPushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        courierId: courier.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
      },
      update: {
        courierId: courier.id,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
      },
    });
    return NextResponse.json(PushSubscribeResult.parse({ subscribed: true }));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}

export async function DELETE(request: Request) {
  try {
    const { courier } = await requireCourier(request);
    const parsed = PushEndpointInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid push endpoint' }, { status: 400 });
    }
    await prisma.courierPushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, courierId: courier.id },
    });
    return NextResponse.json(PushSubscribeResult.parse({ subscribed: false }));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
