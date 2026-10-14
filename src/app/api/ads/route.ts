// Daily ad feed for the signed-in shop. Derives today's ready-to-post ads from
// the live catalogue — nothing is stored, so there is no scheduler to run.
import 'server-only';

import { NextResponse } from 'next/server';
import { buildDailyAds } from '@/lib/ads';
import { AdFeed } from '@/lib/contracts/ads';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { siteUrl } from '@/lib/site';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const now = new Date();
    // Tenancy: the catalogue is reached through the caller's own store.
    const store = await prisma.store.findUnique({
      where: { userId: user.id },
      select: {
        name: true,
        slug: true,
        tagline: true,
        contactPhone: true,
        // Only advertise what the public storefront can actually show: live
        // items whose shelf (if any) is not hidden.
        items: {
          where: { active: true, OR: [{ categoryId: null }, { category: { active: true } }] },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            kind: true,
            name: true,
            description: true,
            categoryId: true,
            pricePesewas: true,
            compareAtPricePesewas: true,
            stock: true,
            imageMime: true,
            category: { select: { name: true } },
          },
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
          select: {
            name: true,
            code: true,
            kind: true,
            value: true,
            minSubtotalPesewas: true,
            startsAt: true,
            endsAt: true,
            itemIds: true,
            categoryIds: true,
          },
        },
      },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const feed = buildDailyAds({
      storeName: store.name,
      storeSlug: store.slug,
      storeTagline: store.tagline,
      storeUrl: `${siteUrl}/store/${store.slug}`,
      items: store.items.map((item) => ({
        id: item.id,
        kind: item.kind,
        name: item.name,
        description: item.description,
        categoryId: item.categoryId,
        categoryName: item.category?.name ?? null,
        pricePesewas: item.pricePesewas,
        compareAtPricePesewas: item.compareAtPricePesewas,
        stock: item.stock,
        hasImage: item.imageMime != null,
      })),
      promotions: store.promotions.map((promotion) => ({
        name: promotion.name,
        code: promotion.code,
        kind: promotion.kind,
        value: promotion.value,
        minSubtotalPesewas: promotion.minSubtotalPesewas,
        startsAt: promotion.startsAt ? promotion.startsAt.toISOString() : null,
        endsAt: promotion.endsAt ? promotion.endsAt.toISOString() : null,
        active: true,
        itemIds: promotion.itemIds,
        categoryIds: promotion.categoryIds,
      })),
      date: now,
    });

    return NextResponse.json(AdFeed.parse({ ...feed, contactPhone: store.contactPhone }));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
