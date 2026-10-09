// authenticated category cover API. PUT attaches a cover photo (multipart
// 'file' field), DELETE removes it. Covers live in Postgres (bytea) like item
// photos; the storefront references a public image URL.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readImageUpload } from '@/lib/image-upload';
import { requireOwnedCategory } from '@/lib/ownership';
import { requireAuth } from '@/lib/require-auth';
import { serializeCategory } from '@/lib/store-serializers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ categoryId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { categoryId } = await context.params;
    // Tenancy: the cover is only ever attached to the caller's own shelf.
    await requireOwnedCategory(user.id, categoryId);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Expected a multipart form upload.' }, { status: 400 });
    }
    const image = await readImageUpload(form, 'item');
    if (!image.ok) return NextResponse.json({ error: image.error }, { status: 400 });

    const category = await prisma.productCategory.update({
      where: { id: categoryId },
      data: { cover: image.bytes, coverMime: image.mime },
      include: { _count: { select: { items: true } } },
    });
    return NextResponse.json(serializeCategory(category));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { categoryId } = await context.params;
    await requireOwnedCategory(user.id, categoryId);

    const category = await prisma.productCategory.update({
      where: { id: categoryId },
      data: { cover: null, coverMime: null },
      include: { _count: { select: { items: true } } },
    });
    return NextResponse.json(serializeCategory(category));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
