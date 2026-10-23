// Merchant broadcast: offer a local-delivery order to the shop's approved,
// online crew. Safe to call again to widen the radius or re-ping the crew.
import 'server-only';

import { NextResponse } from 'next/server';
import { DispatchInput, DispatchResult } from '@/lib/contracts/courier';
import { prisma } from '@/lib/db';
import { DispatchError, dispatchOrder } from '@/lib/dispatch';
import { requireAuth } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { orderId } = await context.params;
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      select: { id: true },
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const parsed = DispatchInput.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid dispatch radius' }, { status: 400 });
    }

    try {
      const result = await dispatchOrder(order.id, {
        radiusKm: parsed.data.radiusKm,
        restart: true,
      });
      return NextResponse.json(
        DispatchResult.parse({
          ok: true,
          offers: result.offers,
          onlineCouriers: result.onlineCouriers,
          radiusKm: result.radiusKm,
          handoffCode: result.handoffCode,
        }),
      );
    } catch (error) {
      if (error instanceof DispatchError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
