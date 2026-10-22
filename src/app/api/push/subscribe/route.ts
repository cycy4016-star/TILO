import 'server-only';

import { NextResponse } from 'next/server';
import {
  PushEndpointInput,
  PushSubscribeResult,
  PushSubscriptionInput,
} from '@/lib/contracts/push';
import { prisma } from '@/lib/db';
import { isPushConfigured } from '@/lib/push';
import { requireAuth } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    if (!isPushConfigured()) {
      return NextResponse.json({ error: 'Web Push is not configured' }, { status: 503 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    const parsed = PushSubscriptionInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 });
    }

    const input = parsed.data;
    const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;

    await prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId: user.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent,
      },
      update: {
        userId: user.id,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent,
      },
    });

    return NextResponse.json(PushSubscribeResult.parse({ subscribed: true }));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    const parsed = PushEndpointInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid push endpoint' }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, userId: user.id },
    });
    return NextResponse.json(PushSubscribeResult.parse({ subscribed: false }));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
