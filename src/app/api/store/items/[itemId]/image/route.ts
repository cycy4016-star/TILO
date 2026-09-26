// authenticated item photo API. PUT attaches a photo (multipart 'file' field),
// DELETE removes it. Images live in Postgres (bytea) so they survive Render's
// ephemeral disk; the dashboard and storefront reference a public image URL.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readImageUpload } from '@/lib/image-upload';
import { requireOwnedStoreChild } from '@/lib/ownership';
import { requireAuth } from '@/lib/require-auth';
import { serializeStoreItem } from '@/lib/store-serializers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ itemId: string }> };

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

    const item = await prisma.storeItem.update({
      where: { id: itemId },
      data: { image: image.bytes, imageMime: image.mime },
    });
    return NextResponse.json(serializeStoreItem(item));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { itemId } = await context.params;
    await requireOwnedStoreChild(user.id, 'item', itemId);

    const item = await prisma.storeItem.update({
      where: { id: itemId },
      data: { image: null, imageMime: null },
    });
    return NextResponse.json(serializeStoreItem(item));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
