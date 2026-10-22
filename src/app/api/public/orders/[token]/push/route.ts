// Buyer push registration on the signed tracking token. No account: the token
// is the capability, and the subscription is deleted with the order.
import 'server-only';

import { NextResponse } from 'next/server';
import {
  PushEndpointInput,
  PushSubscribeResult,
  PushSubscriptionInput,
} from '@/lib/contracts/push';
import { SimplePushConfig } from '@/lib/contracts/simple-push';
import { prisma } from '@/lib/db';
import { verifyOrderToken } from '@/lib/order-tracking';
import { isPushConfigured } from '@/lib/push';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ token: string }> };

async function orderIdFrom(context: RouteContext): Promise<string | null> {
  const { token } = await context.params;
  return verifyOrderToken(token);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const orderId = await orderIdFrom(context);
    if (!orderId) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    const configured = isPushConfigured();
    const subscribed = configured
      ? (await prisma.orderPushSubscription.count({ where: { orderId } })) > 0
      : false;
    return NextResponse.json(
      SimplePushConfig.parse({
        configured,
        publicKey: configured ? (process.env.VAPID_PUBLIC_KEY ?? null) : null,
        subscribed,
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const orderId = await orderIdFrom(context);
    if (!orderId) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (!isPushConfigured()) {
      return NextResponse.json({ error: 'Web Push is not configured' }, { status: 503 });
    }
    const parsed = PushSubscriptionInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 });
    }
    const input = parsed.data;
    await prisma.orderPushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        orderId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
      },
      update: {
        orderId,
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

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const orderId = await orderIdFrom(context);
    if (!orderId) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    const parsed = PushEndpointInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid push endpoint' }, { status: 400 });
    }
    await prisma.orderPushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, orderId },
    });
    return NextResponse.json(PushSubscribeResult.parse({ subscribed: false }));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
