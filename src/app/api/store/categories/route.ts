// authenticated store category API: list + create the shelf headings a
// catalogue is grouped into. One store per account, so there is no storeId in
// the URL — tenancy is resolved from the session like every other store route.
import 'server-only';

import { NextResponse } from 'next/server';
import { isCategoryIcon } from '@/lib/category-icons';
import { CategoryCreate, CategoryList } from '@/lib/contracts/category';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { serializeCategory } from '@/lib/store-serializers';

export const dynamic = 'force-dynamic';

// Matches the item ordering so the manager's shelf list and the catalogue it
// groups agree on where a new heading lands.
const includeWithCount = { include: { _count: { select: { items: true } } } } as const;

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    // Tenancy: categories are reached through the caller's own store.
    const store = await prisma.store.findUnique({ where: { userId: user.id } });
    if (!store) return NextResponse.json(CategoryList.parse({ items: [] }));
    const categories = await prisma.productCategory.findMany({
      where: { storeId: store.id },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      ...includeWithCount,
    });
    return NextResponse.json(CategoryList.parse({ items: categories.map(serializeCategory) }));
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
    const parsed = CategoryCreate.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);
    if (!isCategoryIcon(parsed.data.icon ?? null)) {
      return NextResponse.json({ errors: { icon: 'Pick an icon from the list' } }, { status: 400 });
    }

    // Two shelves may not share a name inside one store — the storefront groups
    // by label, so a duplicate would silently merge two headings.
    const clash = await prisma.productCategory.findFirst({
      where: { storeId: store.id, name: parsed.data.name },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json(
        { errors: { name: 'You already have a category with that name' } },
        { status: 409 },
      );
    }

    const category = await prisma.productCategory.create({
      data: {
        storeId: store.id,
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder,
        active: parsed.data.active,
        icon: parsed.data.icon ?? null,
      },
      ...includeWithCount,
    });
    return NextResponse.json(serializeCategory(category), { status: 201 });
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
