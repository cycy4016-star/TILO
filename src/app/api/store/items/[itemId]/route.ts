// authenticated store item update/delete API.
import 'server-only';

import { NextResponse } from 'next/server';
import { StoreItemUpdate } from '@/lib/contracts/store';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { serializeStoreItem } from '@/lib/store-serializers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ itemId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAuth(request);
    const { itemId } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = StoreItemUpdate.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    const existing = await prisma.storeItem.findUnique({ where: { id: itemId } });
    if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const item = await prisma.storeItem.update({ where: { id: itemId }, data: parsed.data });
    return NextResponse.json(serializeStoreItem(item));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requireAuth(request);
    const { itemId } = await context.params;
    const existing = await prisma.storeItem.findUnique({ where: { id: itemId } });
    if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    await prisma.storeItem.delete({ where: { id: itemId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function validationResponse(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    const message = messages[0];
    if (message) errors[field] = message;
  }
  return NextResponse.json({ errors }, { status: 400 });
}
