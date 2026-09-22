// public item photo — no auth. Serves the bytea stored on StoreItem so the
// storefront (and the dashboard preview) can render <img src> without the
// visitor needing an account. 404 when the item has no photo.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ itemId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { itemId } = await context.params;
    const item = await prisma.storeItem.findUnique({
      where: { id: itemId },
      select: { image: true, imageMime: true },
    });
    if (!item?.image) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    return new Response(item.image, {
      headers: {
        'content-type': item.imageMime ?? 'image/jpeg',
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
