// Private image bytes for the admin proof gallery. Only consented proofs are
// served here; the buyer's photo is never made public by this route.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireAdminUser(request);
    const { id } = await context.params;
    const proof = await prisma.deliveryProof.findFirst({
      where: { id, marketingConsent: true },
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
