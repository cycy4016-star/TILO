// authenticated promotion banner image API. PUT attaches artwork (multipart
// 'file' field), DELETE removes it. Stored in Postgres so it survives Render's
// ephemeral disk, like store logos and item photos.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readImageUpload } from '@/lib/image-upload';
import { requireAuth } from '@/lib/require-auth';
import { serializePromotion } from '@/lib/store-serializers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ promoId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    await requireAuth(request);
    const { promoId } = await context.params;
    const existing = await prisma.promotion.findUnique({ where: { id: promoId } });
    if (!existing) return NextResponse.json({ error: 'Promo not found' }, { status: 404 });

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Expected a multipart form upload.' }, { status: 400 });
    }
    const image = await readImageUpload(form, 'promo');
    if (!image.ok) return NextResponse.json({ error: image.error }, { status: 400 });

    const updated = await prisma.promotion.update({
      where: { id: promoId },
      data: { image: image.bytes, imageMime: image.mime },
    });
    return NextResponse.json(serializePromotion(updated));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requireAuth(request);
    const { promoId } = await context.params;
    const existing = await prisma.promotion.findUnique({ where: { id: promoId } });
    if (!existing) return NextResponse.json({ error: 'Promo not found' }, { status: 404 });

    const updated = await prisma.promotion.update({
      where: { id: promoId },
      data: { image: null, imageMime: null },
    });
    return NextResponse.json(serializePromotion(updated));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
