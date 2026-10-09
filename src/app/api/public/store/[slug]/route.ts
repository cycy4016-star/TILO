// public storefront API — no auth. Serves the live catalog for /store/[slug]
// so visitors can browse without a Tilo account. Only live promotions (active +
// inside their date window) are included.
import 'server-only';

import { NextResponse } from 'next/server';
import { AppearanceKey, StorePublic, ThemeKey } from '@/lib/contracts/store';
import { prisma } from '@/lib/db';
import { normalizeAppearance, normalizeTheme } from '@/lib/theme';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const now = new Date();
    const store = await prisma.store.findFirst({
      where: { slug, active: true },
      include: {
        categories: {
          where: { active: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        items: {
          // Live products only. An item also drops out when its shelf is
          // hidden, so switching a category off takes the whole shelf off the
          // storefront instead of stranding those products under no heading.
          where: {
            active: true,
            OR: [{ categoryId: null }, { category: { active: true } }],
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        promotions: {
          where: {
            active: true,
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
              { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            ],
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    return NextResponse.json(
      StorePublic.parse({
        name: store.name,
        slug: store.slug,
        tagline: store.tagline,
        description: store.description,
        promoBanner: store.promoBanner,
        contactPhone: store.contactPhone,
        logoUrl: store.logo
          ? `/api/public/store/${store.slug}/logo?t=${store.updatedAt.getTime()}`
          : null,
        bannerUrl: store.banner
          ? `/api/public/store/${store.slug}/banner?t=${store.updatedAt.getTime()}`
          : null,
        theme: ThemeKey.parse(normalizeTheme(store.theme)),
        appearance: AppearanceKey.parse(normalizeAppearance(store.appearance)),
        categories: store.categories.map((category) => ({
          id: category.id,
          name: category.name,
          sortOrder: category.sortOrder,
          icon: category.icon,
          coverUrl: category.cover
            ? `/api/public/store/categories/${category.id}/image?t=${category.updatedAt.getTime()}`
            : null,
        })),
        items: store.items.map((item) => ({
          id: item.id,
          kind: item.kind,
          name: item.name,
          description: item.description,
          categoryId: item.categoryId,
          pricePesewas: item.pricePesewas,
          compareAtPricePesewas: item.compareAtPricePesewas,
          stock: item.stock,
          imageUrl: item.image
            ? `/api/public/store/items/${item.id}/image?t=${item.updatedAt.getTime()}`
            : null,
        })),
        promotions: store.promotions.map((promotion) => ({
          name: promotion.name,
          code: promotion.code,
          kind: promotion.kind,
          value: promotion.value,
          minSubtotalPesewas: promotion.minSubtotalPesewas,
          startsAt: promotion.startsAt ? promotion.startsAt.toISOString() : null,
          endsAt: promotion.endsAt ? promotion.endsAt.toISOString() : null,
          itemIds: promotion.itemIds,
          categoryIds: promotion.categoryIds,
          imageUrl: promotion.image
            ? `/api/public/store/promotions/${promotion.id}/image?t=${promotion.updatedAt.getTime()}`
            : null,
        })),
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
