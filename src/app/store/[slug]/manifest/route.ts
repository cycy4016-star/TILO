// Buyer-facing PWA manifest. The root manifest starts at /dashboard for
// sellers; this one installs the shop itself so a buyer opening the app lands
// back on the storefront, not the merchant dashboard.
import type { MetadataRoute } from 'next';
import { NextResponse } from 'next/server';
import { brandVisual } from '@/lib/brand';
import { prisma } from '@/lib/db';
import { siteName } from '@/lib/site';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

function shortName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length <= 12 ? trimmed : trimmed.slice(0, 12).trimEnd();
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const store = await prisma.store.findFirst({
    where: { slug, active: true },
    select: {
      name: true,
      slug: true,
      tagline: true,
      description: true,
      logoMime: true,
    },
  });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const description =
    store.tagline?.trim() || store.description?.trim() || `Shop ${store.name} on ${siteName}.`;

  const manifest: MetadataRoute.Manifest = {
    id: `/store/${store.slug}`,
    name: store.name,
    short_name: shortName(store.name),
    description,
    start_url: `/store/${store.slug}`,
    scope: `/store/${store.slug}`,
    display: 'standalone',
    background_color: brandVisual.backgroundColor,
    theme_color: brandVisual.themeColor,
    categories: ['shopping'],
    icons: [
      ...(store.logoMime
        ? [
            {
              src: `/api/public/store/${store.slug}/logo`,
              type: store.logoMime,
              sizes: 'any',
              purpose: 'any' as const,
            },
          ]
        : []),
      {
        src: '/icons/icon-192.png?v=2',
        type: 'image/png',
        sizes: '192x192',
        purpose: 'any' as const,
      },
      {
        src: '/icons/icon-512.png?v=2',
        type: 'image/png',
        sizes: '512x512',
        purpose: 'any' as const,
      },
      {
        src: '/icons/icon-maskable-512.png?v=2',
        type: 'image/png',
        sizes: '512x512',
        purpose: 'maskable' as const,
      },
    ],
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
