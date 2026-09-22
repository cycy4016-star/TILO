// public promo banner image — no auth. Serves the bytea stored on the
// Promotion so the storefront can render <img src> without the visitor needing
// an account. 404 when the promo has no artwork.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ promoId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { promoId } = await context.params;
    const promotion = await prisma.promotion.findUnique({
      where: { id: promoId },
      select: { image: true, imageMime: true },
    });
    if (!promotion?.image) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    return new Response(promotion.image, {
      headers: {
        'content-type': promotion.imageMime ?? 'image/jpeg',
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
