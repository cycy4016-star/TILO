// authenticated store catalog API: list + add store items.
import 'server-only';

import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { StoreItemCreate, StoreItemList } from '@/lib/contracts/store';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { serializeStoreItem } from '@/lib/store-serializers';

export const dynamic = 'force-dynamic';

const ITEM_ORDER: Prisma.StoreItemOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { name: 'asc' },
];

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    // Tenancy: the catalogue is reached through the caller's own store.
    const store = await prisma.store.findUnique({ where: { userId: user.id } });
    if (!store) return NextResponse.json(StoreItemList.parse({ items: [] }));
    const items = await prisma.storeItem.findMany({
      where: { storeId: store.id },
      orderBy: ITEM_ORDER,
    });
    return NextResponse.json(StoreItemList.parse({ items: items.map(serializeStoreItem) }));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const store = await prisma.store.findUnique({ where: { userId: user.id } });
    if (!store) {
      return NextResponse.json({ errors: { form: 'Create the store first' } }, { status: 409 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = StoreItemCreate.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    const item = await prisma.storeItem.create({
      data: { ...parsed.data, storeId: store.id },
    });
    return NextResponse.json(serializeStoreItem(item), { status: 201 });
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
