// Merchant's own confirmation, separate from the buyer's photo confirmation.
// This is the audit trail the team uses for exceptions and high-value orders.
import 'server-only';

import { NextResponse } from 'next/server';
import { MerchantVerifyInput } from '@/lib/contracts/courier';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { orderId } = await context.params;
    const parsed = MerchantVerifyInput.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid verification note' }, { status: 400 });
    }
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      select: { id: true, deliveryStatus: true, merchantVerifiedAt: true },
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.deliveryStatus !== 'DELIVERED') {
      return NextResponse.json(
        { error: 'Only a delivered order can be verified by the shop.' },
        { status: 409 },
      );
    }
    if (order.merchantVerifiedAt) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          merchantVerifiedAt: new Date(),
          merchantVerifiedBy: user.id,
          deliveryNote: parsed.data.note ?? null,
        },
      }),
      prisma.deliveryEvent.create({
        data: {
          orderId: order.id,
          type: 'MERCHANT_VERIFIED',
          actorType: 'MERCHANT',
          actorId: user.id,
          note: parsed.data.note ?? null,
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
