// authenticated store settings API. One store per account: GET returns the
// signed-in user's own store (or 404 until created), PUT creates or updates it.
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
    const user = await requireAuth(request);
    // Tenancy: resolved through Store.userId (unique) — never a global
    // findFirst, which would hand the caller whichever shop happened to be first.
    const store = await prisma.store.findUnique({
      where: { userId: user.id },
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
    const user = await requireAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = StoreUpsert.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    const existing = await prisma.store.findUnique({ where: { userId: user.id } });
    const data = parsed.data;
    let store: StoreWithItems;
    try {
      store = existing
        ? await prisma.store.update({
            where: { id: existing.id },
            data,
            ...storeWithItems,
          })
        : await prisma.store.create({
            // One storefront per account: userId is stamped from the session and
            // is unique, so a second sign-up can never hijack this shop's URL.
            data: { ...data, userId: user.id },
            ...storeWithItems,
          });
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
