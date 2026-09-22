// authenticated profile avatar API. PUT stores a (client-compressed) avatar as
// a data URL on the better-auth `User.image` field; DELETE clears it. The cost
// of a DB round-trip beats standing up object storage for a storefront.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readImageUpload } from '@/lib/image-upload';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  try {
    const user = await requireAuth(request);
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Expected a multipart form upload.' }, { status: 400 });
    }
    const image = await readImageUpload(form, 'avatar');
    if (!image.ok) return NextResponse.json({ error: image.error }, { status: 400 });

    const dataUrl = `data:${image.mime};base64,${Buffer.from(image.bytes).toString('base64')}`;
    await prisma.user.update({ where: { id: user.id }, data: { image: dataUrl } });
    return NextResponse.json({ image: dataUrl });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth(request);
    await prisma.user.update({ where: { id: user.id }, data: { image: null } });
    return NextResponse.json({ image: null });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
