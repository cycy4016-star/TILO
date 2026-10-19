// public gallery photo — no auth. Serves one StoreItemImage row so the
// storefront can render every photo in an item's gallery. 404 when missing.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { imageCacheHeaders, notModified } from '@/lib/image-response';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ itemId: string; imageId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { itemId, imageId } = await context.params;
    const image = await prisma.storeItemImage.findFirst({
      where: { id: imageId, itemId },
      select: { image: true, imageMime: true, updatedAt: true },
    });
    if (!image) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    const fresh = notModified(request, image.updatedAt);
    if (fresh) return fresh;
    return new Response(image.image, {
      headers: {
        'content-type': image.imageMime ?? 'image/jpeg',
        ...imageCacheHeaders(image.updatedAt),
      },
    });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
