// Authenticated gallery API: append a photo to an item. The first photo (lowest
// position) is the cover; the storefront shows the rest as thumbnails.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readImageUpload } from '@/lib/image-upload';
import { MAX_ITEM_PHOTOS } from '@/lib/item-images';
import { requireOwnedStoreChild } from '@/lib/ownership';
import { requireAuth } from '@/lib/require-auth';
import { ITEM_SELECT, serializeStoreItem } from '@/lib/store-serializers';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ itemId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { itemId } = await context.params;
    await requireOwnedStoreChild(user.id, 'item', itemId);

    const count = await prisma.storeItemImage.count({ where: { itemId } });
    if (count >= MAX_ITEM_PHOTOS) {
      return NextResponse.json(
        { error: `You can add up to ${MAX_ITEM_PHOTOS} photos per product.` },
        { status: 400 },
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Expected a multipart form upload.' }, { status: 400 });
    }
    const image = await readImageUpload(form, 'item');
    if (!image.ok) return NextResponse.json({ error: image.error }, { status: 400 });

    const last = await prisma.storeItemImage.aggregate({
      where: { itemId },
      _max: { position: true },
    });

    await prisma.$transaction([
      prisma.storeItemImage.create({
        data: {
          itemId,
          position: (last._max.position ?? -1) + 1,
          image: image.bytes,
          imageMime: image.mime,
        },
      }),
      // Bump the item so its updatedAt (the dashboard's cache-buster) moves
      // and keep the legacy presence flag honest.
      prisma.storeItem.update({ where: { id: itemId }, data: { imageMime: image.mime } }),
    ]);

    const item = await prisma.storeItem.findUniqueOrThrow({
      where: { id: itemId },
      select: ITEM_SELECT,
    });
    return NextResponse.json(serializeStoreItem(item));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
