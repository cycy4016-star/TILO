// authenticated store promotion update/delete API.
import 'server-only';

import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { PromotionUpdate } from '@/lib/contracts/promotion';
import { prisma } from '@/lib/db';
import { requireOwnedStoreChild } from '@/lib/ownership';
import { dateOnlyToDate } from '@/lib/promotions';
import { requireAuth } from '@/lib/require-auth';
import { serializePromotion } from '@/lib/store-serializers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ promoId: string }> };

// Build a Prisma data object that only touches keys the client actually sent.
function dataFromInput(input: z.output<typeof PromotionUpdate>): Prisma.PromotionUpdateInput {
  const data: Prisma.PromotionUpdateInput = {};
  if ('name' in input) data.name = input.name;
  if ('code' in input) data.code = input.code ?? null;
  if ('kind' in input) data.kind = input.kind;
  if ('value' in input) data.value = input.value;
  if ('minSubtotalPesewas' in input) data.minSubtotalPesewas = input.minSubtotalPesewas ?? null;
  if ('active' in input) data.active = input.active;
  if ('startsAt' in input) data.startsAt = dateOnlyToDate(input.startsAt);
  if ('endsAt' in input) data.endsAt = dateOnlyToDate(input.endsAt);
  return data;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { promoId } = await context.params;
    // Tenancy: resolved through the caller's own store before any write.
    await requireOwnedStoreChild(user.id, 'promotion', promoId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = PromotionUpdate.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    const promotion = await prisma.promotion.update({
      where: { id: promoId },
      data: dataFromInput(parsed.data),
    });
    return NextResponse.json(serializePromotion(promotion));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { promoId } = await context.params;
    await requireOwnedStoreChild(user.id, 'promotion', promoId);
    await prisma.promotion.delete({ where: { id: promoId } });
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
