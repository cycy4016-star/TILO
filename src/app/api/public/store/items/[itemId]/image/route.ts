// public item photo — no auth. Serves the cover photo (lowest gallery
// position) so older links and clients keep working; the gallery route serves
// the rest. 404 when the item has no photos.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { imageCacheHeaders, notModified } from '@/lib/image-response';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ itemId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { itemId } = await context.params;
    const cover = await prisma.storeItemImage.findFirst({
      where: { itemId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { image: true, imageMime: true, updatedAt: true },
    });
    if (cover) {
      const fresh = notModified(request, cover.updatedAt);
      if (fresh) return fresh;
      return new Response(cover.image, {
        headers: {
          'content-type': cover.imageMime ?? 'image/jpeg',
          ...imageCacheHeaders(cover.updatedAt),
        },
      });
    }

    // Fallback for a row that predates the gallery migration.
    const item = await prisma.storeItem.findUnique({
      where: { id: itemId },
      select: { image: true, imageMime: true, updatedAt: true },
    });
    if (!item?.image) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    const fresh = notModified(request, item.updatedAt);
    if (fresh) return fresh;
    return new Response(item.image, {
      headers: {
        'content-type': item.imageMime ?? 'image/jpeg',
        ...imageCacheHeaders(item.updatedAt),
      },
    });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
