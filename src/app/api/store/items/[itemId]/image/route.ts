// authenticated item photo API. PUT attaches/replaces the cover photo
// (multipart 'file' field), DELETE removes it. Kept for older clients; the
// gallery API (…/images) manages the full set. Images live in Postgres (bytea)
// so they survive redeploys; the dashboard and storefront reference a public
// image URL.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readImageUpload } from '@/lib/image-upload';
import { requireOwnedStoreChild } from '@/lib/ownership';
import { requireAuth } from '@/lib/require-auth';
import { ITEM_SELECT, serializeStoreItem } from '@/lib/store-serializers';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ itemId: string }> };

async function coverImage(itemId: string) {
  return prisma.storeItemImage.findFirst({
    where: { itemId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { itemId } = await context.params;
    // Tenancy: the photo is only ever attached to the caller's own item.
    await requireOwnedStoreChild(user.id, 'item', itemId);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Expected a multipart form upload.' }, { status: 400 });
    }
    const image = await readImageUpload(form, 'item');
    if (!image.ok) return NextResponse.json({ error: image.error }, { status: 400 });

    const cover = await coverImage(itemId);
    if (cover) {
      await prisma.storeItemImage.update({
        where: { id: cover.id },
        data: { image: image.bytes, imageMime: image.mime },
      });
    } else {
      await prisma.storeItemImage.create({
        data: { itemId, position: 0, image: image.bytes, imageMime: image.mime },
      });
    }
    await prisma.storeItem.update({ where: { id: itemId }, data: { imageMime: image.mime } });

    const item = await prisma.storeItem.findUniqueOrThrow({
      where: { id: itemId },
      select: ITEM_SELECT,
    });
    return NextResponse.json(serializeStoreItem(item));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { itemId } = await context.params;
    await requireOwnedStoreChild(user.id, 'item', itemId);

    const cover = await coverImage(itemId);
    if (cover) await prisma.storeItemImage.delete({ where: { id: cover.id } });

    const next = await coverImage(itemId);
    const nextMime = next
      ? (
          await prisma.storeItemImage.findUniqueOrThrow({
            where: { id: next.id },
            select: { imageMime: true },
          })
        ).imageMime
      : null;
    // Also clear the legacy bytea columns so a pre-gallery row cannot resurface.
    const item = await prisma.storeItem.update({
      where: { id: itemId },
      data: { image: null, imageMime: nextMime },
      select: ITEM_SELECT,
    });
    return NextResponse.json(serializeStoreItem(item));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
