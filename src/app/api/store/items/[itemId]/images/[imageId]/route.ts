// Authenticated gallery API for one photo. PUT promotes it to cover (the
// lowest position); DELETE removes it and the next photo becomes the cover.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOwnedStoreChild } from '@/lib/ownership';
import { requireAuth } from '@/lib/require-auth';
import { ITEM_SELECT, serializeStoreItem } from '@/lib/store-serializers';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ itemId: string; imageId: string }> };

async function serializedItem(itemId: string) {
  const item = await prisma.storeItem.findUniqueOrThrow({
    where: { id: itemId },
    select: ITEM_SELECT,
  });
  return NextResponse.json(serializeStoreItem(item));
}

// Make this photo the cover. Positions are renumbered so the order stays dense
// and deterministic.
export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { itemId, imageId } = await context.params;
    await requireOwnedStoreChild(user.id, 'item', itemId);

    const images = await prisma.storeItemImage.findMany({
      where: { itemId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    if (!images.some((image) => image.id === imageId)) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const ordered = [imageId, ...images.map((image) => image.id).filter((id) => id !== imageId)];
    await prisma.$transaction(
      ordered.map((id, position) =>
        prisma.storeItemImage.update({ where: { id }, data: { position } }),
      ),
    );

    const cover = await prisma.storeItemImage.findUniqueOrThrow({
      where: { id: imageId },
      select: { imageMime: true },
    });
    await prisma.storeItem.update({
      where: { id: itemId },
      data: { imageMime: cover.imageMime },
    });
    return await serializedItem(itemId);
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { itemId, imageId } = await context.params;
    await requireOwnedStoreChild(user.id, 'item', itemId);

    const image = await prisma.storeItemImage.findFirst({
      where: { id: imageId, itemId },
      select: { id: true },
    });
    if (!image) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

    await prisma.storeItemImage.delete({ where: { id: imageId } });

    const next = await prisma.storeItemImage.findFirst({
      where: { itemId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { imageMime: true },
    });
    await prisma.storeItem.update({
      where: { id: itemId },
      data: { imageMime: next?.imageMime ?? null },
    });
    return await serializedItem(itemId);
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
