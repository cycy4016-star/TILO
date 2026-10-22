// Buyer confirms receipt with the six-digit handoff code and a receiver-taken
// photo. This is separate from the merchant's own verification; neither side
// can overwrite the other's audit event.
import 'server-only';

import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readImageUpload } from '@/lib/image-upload';
import { verifyOrderToken } from '@/lib/order-tracking';
import { sendPushToUser } from '@/lib/push';
import { allow, ipOf } from '@/lib/rate-limit';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    if (!allow(`${ipOf(request)}:order-confirm`, 6)) {
      return NextResponse.json({ error: 'Too many attempts — slow down' }, { status: 429 });
    }
    const { token } = await context.params;
    const orderId = verifyOrderToken(token);
    if (!orderId) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Expected a multipart form upload.' }, { status: 400 });
    }
    const code = String(form.get('code') ?? '').trim();
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the six-digit handoff code.' }, { status: 400 });
    }
    const image = await readImageUpload(form, 'proof');
    if (!image.ok) return NextResponse.json({ error: image.error }, { status: 400 });
    const consent = String(form.get('consent') ?? '') === 'true';

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        deliveryStatus: true,
        handoffCode: true,
        buyerConfirmedAt: true,
        courierId: true,
        user: { select: { store: { select: { id: true } } } },
      },
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.deliveryStatus !== 'DELIVERED') {
      return NextResponse.json(
        { error: 'The rider has not marked this delivery as delivered yet.' },
        { status: 409 },
      );
    }
    if (order.buyerConfirmedAt) {
      return NextResponse.json({ error: 'This delivery is already confirmed' }, { status: 409 });
    }
    if (!order.handoffCode || order.handoffCode !== code) {
      return NextResponse.json({ error: 'That handoff code does not match.' }, { status: 400 });
    }

    const bytes = image.bytes;
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: {
          id: order.id,
          deliveryStatus: 'DELIVERED',
          buyerConfirmedAt: null,
          handoffCode: code,
        },
        data: { buyerConfirmedAt: now, handoffCodeUsedAt: now },
      });
      if (claimed.count === 0) {
        throw Response.json({ error: 'This delivery was already confirmed' }, { status: 409 });
      }
      await tx.deliveryProof.create({
        data: {
          orderId: order.id,
          data: bytes,
          mime: image.mime,
          size: bytes.byteLength,
          sha256,
          marketingConsent: consent,
        },
      });
      await tx.deliveryEvent.create({
        data: {
          orderId: order.id,
          storeId: order.user.store?.id,
          courierId: order.courierId,
          type: 'BUYER_CONFIRMED',
          actorType: 'BUYER',
          note: consent ? 'Proof photo + marketing consent' : 'Proof photo',
        },
      });
      await tx.deliveryEvent.create({
        data: {
          orderId: order.id,
          storeId: order.user.store?.id,
          courierId: order.courierId,
          type: 'HANDOFF_VERIFIED',
          actorType: 'SYSTEM',
        },
      });
    });

    await sendPushToUser(order.userId, {
      title: 'Buyer confirmed delivery',
      body: `#${order.orderNumber} — proof photo uploaded.`,
      url: '/dashboard/delivery',
      tag: `order-${order.id}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
