// public promo banner image — no auth. Serves the bytea stored on the
// Promotion so the storefront can render <img src> without the visitor needing
// an account. 404 when the promo has no artwork.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { imageCacheHeaders, notModified } from '@/lib/image-response';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ promoId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { promoId } = await context.params;
    const promotion = await prisma.promotion.findUnique({
      where: { id: promoId },
      select: { image: true, imageMime: true, updatedAt: true },
    });
    if (!promotion?.image) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    const fresh = notModified(request, promotion.updatedAt);
    if (fresh) return fresh;
    return new Response(promotion.image, {
      headers: {
        'content-type': promotion.imageMime ?? 'image/jpeg',
        ...imageCacheHeaders(promotion.updatedAt),
      },
    });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
