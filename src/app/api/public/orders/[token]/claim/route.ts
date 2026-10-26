import 'server-only';

import { NextResponse } from 'next/server';
import { ensureAudience } from '@/lib/audiences';
import { OrderClaimResult } from '@/lib/contracts/shopper';
import { prisma } from '@/lib/db';
import { verifyOrderToken } from '@/lib/order-tracking';
import { requireAuth, type SessionUser } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ token: string }> };

function conflict(error: string) {
  return NextResponse.json({ error }, { status: 409 });
}

async function claimedResponse(user: SessionUser) {
  await ensureAudience(user.id, 'SHOPPER');
  return NextResponse.json(OrderClaimResult.parse({ ok: true }));
}

export async function POST(request: Request, context: RouteContext) {
  try {
    let user: SessionUser;
    try {
      user = await requireAuth(request);
    } catch (response) {
      return response as Response;
    }

    const { token } = await context.params;
    const orderId = verifyOrderToken(token);
    if (!orderId) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, shopperId: true },
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.userId === user.id) {
      return conflict('This order belongs to your shop.');
    }
    if (order.shopperId === user.id) return claimedResponse(user);
    if (order.shopperId) {
      return conflict('This order is already saved to another account.');
    }

    await ensureAudience(user.id, 'SHOPPER');
    const claimed = await prisma.order.updateMany({
      where: { id: orderId, shopperId: null },
      data: { shopperId: user.id },
    });
    if (claimed.count === 0) {
      const current = await prisma.order.findUnique({
        where: { id: orderId },
        select: { userId: true, shopperId: true },
      });
      if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      if (current.shopperId === user.id) return claimedResponse(user);
      return conflict('This order is already saved to another account.');
    }

    return NextResponse.json(OrderClaimResult.parse({ ok: true }));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
