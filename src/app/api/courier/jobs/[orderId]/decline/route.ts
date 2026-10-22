// Courier declines an offer. The job stays open for the rest of the crew.
import 'server-only';

import { NextResponse } from 'next/server';
import { requireCourier } from '@/lib/courier-auth';
import { prisma } from '@/lib/db';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { courier } = await requireCourier(request);
    const { orderId } = await context.params;
    const updated = await prisma.deliveryOffer.updateMany({
      where: { orderId, courierId: courier.id, status: 'OFFERED' },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
    return NextResponse.json({ ok: true, declined: updated.count > 0 });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
