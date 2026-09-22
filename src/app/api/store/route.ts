// authenticated store settings API. One store per workspace: GET returns it
// (or 404 until created), PUT creates or updates it.
import 'server-only';

import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { StoreUpsert } from '@/lib/contracts/store';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { serializeStore } from '@/lib/store-serializers';

export const dynamic = 'force-dynamic';

const ITEM_ORDER: Prisma.StoreItemOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { name: 'asc' },
];

// Canonical include so create/update in GET/PUT stay in one serializable shape.
const storeWithItems = Prisma.validator<Prisma.StoreDefaultArgs>()({
  include: { items: { orderBy: ITEM_ORDER } },
});
type StoreWithItems = Prisma.StoreGetPayload<typeof storeWithItems>;

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const store = await prisma.store.findFirst({
      include: { items: { orderBy: ITEM_ORDER } },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    return NextResponse.json(serializeStore(store));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = StoreUpsert.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    const existing = await prisma.store.findFirst();
    const data = parsed.data;
    let store: StoreWithItems;
    try {
      store = existing
        ? await prisma.store.update({
            where: { id: existing.id },
            data,
            ...storeWithItems,
          })
        : await prisma.store.create({ data, ...storeWithItems });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json(
          { errors: { slug: 'That link is already taken — try another' } },
          { status: 409 },
        );
      }
      throw error;
    }
    return NextResponse.json(serializeStore(store));
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
