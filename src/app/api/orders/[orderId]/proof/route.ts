// Private proof photo for the merchant who owns the order. Never public: the
// buyer's tracking token has its own route and marketing use needs consent.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { orderId } = await context.params;
    const proof = await prisma.deliveryProof.findFirst({
      where: { orderId, order: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
      select: { data: true, mime: true },
    });
    if (!proof) return NextResponse.json({ error: 'Proof not found' }, { status: 404 });
    return new Response(proof.data, {
      headers: {
        'content-type': proof.mime,
        'cache-control': 'private, no-store',
        'content-disposition': 'inline',
      },
    });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
