// authenticated store logo API. PUT attaches a logo (multipart 'file' field),
// DELETE removes it. Stored in Postgres so it survives Render's ephemeral disk.
import 'server-only';

import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readImageUpload } from '@/lib/image-upload';
import { requireAuth } from '@/lib/require-auth';
import { serializeStore } from '@/lib/store-serializers';

export const dynamic = 'force-dynamic';

const ITEM_ORDER: Prisma.StoreItemOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { name: 'asc' },
];

export async function PUT(request: Request) {
  try {
    const user = await requireAuth(request);
    // Tenancy: the logo is written onto the caller's own store only.
    const store = await prisma.store.findUnique({ where: { userId: user.id } });
    if (!store)
      return NextResponse.json({ errors: { form: 'Create the store first' } }, { status: 409 });

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Expected a multipart form upload.' }, { status: 400 });
    }
    const image = await readImageUpload(form, 'logo');
    if (!image.ok) return NextResponse.json({ error: image.error }, { status: 400 });

    const updated = await prisma.store.update({
      where: { id: store.id },
      data: { logo: image.bytes, logoMime: image.mime },
      include: { items: { orderBy: ITEM_ORDER } },
    });
    return NextResponse.json(serializeStore(updated));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth(request);
    const store = await prisma.store.findUnique({ where: { userId: user.id } });
    if (!store)
      return NextResponse.json({ errors: { form: 'Create the store first' } }, { status: 409 });

    const updated = await prisma.store.update({
      where: { id: store.id },
      data: { logo: null, logoMime: null },
      include: { items: { orderBy: ITEM_ORDER } },
    });
    return NextResponse.json(serializeStore(updated));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
