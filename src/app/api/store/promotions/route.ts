// authenticated store promotion API: list + create promos (sales / coupon
// codes). One store per workspace, so there is no storeId in the URL.
import 'server-only';

import { NextResponse } from 'next/server';
import { PromotionCreate, PromotionList } from '@/lib/contracts/promotion';
import { prisma } from '@/lib/db';
import { dateOnlyToDate } from '@/lib/promotions';
import { requireAuth } from '@/lib/require-auth';
import { serializePromotion } from '@/lib/store-serializers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const store = await prisma.store.findFirst();
    if (!store) return NextResponse.json(PromotionList.parse({ items: [] }));
    const promotions = await prisma.promotion.findMany({
      where: { storeId: store.id },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(PromotionList.parse({ items: promotions.map(serializePromotion) }));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    const store = await prisma.store.findFirst();
    if (!store) {
      return NextResponse.json({ errors: { form: 'Create the store first' } }, { status: 409 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = PromotionCreate.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    const promotion = await prisma.promotion.create({
      data: {
        storeId: store.id,
        name: parsed.data.name,
        code: parsed.data.code ?? null,
        kind: parsed.data.kind,
        value: parsed.data.value,
        minSubtotalPesewas: parsed.data.minSubtotalPesewas ?? null,
        active: parsed.data.active,
        startsAt: dateOnlyToDate(parsed.data.startsAt),
        endsAt: dateOnlyToDate(parsed.data.endsAt),
      },
    });
    return NextResponse.json(serializePromotion(promotion), { status: 201 });
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
