// authenticated store category update/delete API.
//
// Delete is refused while products still sit on the shelf: the FK is SetNull,
// so a delete would NOT take the products with it — it would silently strand
// them with no heading. The owner moves them first (or accepts the 409), so
// nothing ever disappears from the catalogue as a side effect.
import 'server-only';

import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { CategoryUpdate } from '@/lib/contracts/category';
import { prisma } from '@/lib/db';
import { requireOwnedCategory } from '@/lib/ownership';
import { requireAuth } from '@/lib/require-auth';
import { serializeCategory } from '@/lib/store-serializers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ categoryId: string }> };

const includeWithCount = { include: { _count: { select: { items: true } } } } as const;

// Build a Prisma data object that only touches keys the client actually sent.
function dataFromInput(input: z.output<typeof CategoryUpdate>): Prisma.ProductCategoryUpdateInput {
  const data: Prisma.ProductCategoryUpdateInput = {};
  if ('name' in input) data.name = input.name;
  if ('sortOrder' in input) data.sortOrder = input.sortOrder;
  if ('active' in input) data.active = input.active;
  return data;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { categoryId } = await context.params;
    // Tenancy: resolved through the caller's own store before any write.
    const category = await requireOwnedCategory(user.id, categoryId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = CategoryUpdate.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    if ('name' in parsed.data && parsed.data.name !== category.name) {
      const clash = await prisma.productCategory.findFirst({
        where: { storeId: category.storeId, name: parsed.data.name },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json(
          { errors: { name: 'You already have a category with that name' } },
          { status: 409 },
        );
      }
    }

    const updated = await prisma.productCategory.update({
      where: { id: categoryId },
      data: dataFromInput(parsed.data),
      ...includeWithCount,
    });
    return NextResponse.json(serializeCategory(updated));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { categoryId } = await context.params;
    const category = await requireOwnedCategory(user.id, categoryId);

    const itemCount = await prisma.storeItem.count({ where: { categoryId: category.id } });
    if (itemCount > 0) {
      return NextResponse.json(
        {
          error: `${itemCount} product${itemCount === 1 ? '' : 's'} still on this shelf`,
          itemCount,
        },
        { status: 409 },
      );
    }

    await prisma.productCategory.delete({ where: { id: categoryId } });
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
