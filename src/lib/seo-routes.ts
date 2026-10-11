// Programmatic SEO URLs for /sitemap.xml: dynamic [slug] pages (e.g.
// /champions/[slug]) that aren't in the nav menu. Return one entry per page with an
// app-absolute `path` ('/...'); may be async to fetch data. Return [] if none.
//
// This is the storefront feed: every ACTIVE shop is a public page at
// /store/[slug] that we want search engines to index. It is the sole dynamic
// source for BOTH /sitemap.xml (src/app/sitemap.ts) and /llms.txt
// (src/lib/llms.ts) — both merge it through the same filters, so a shop listed
// here appears in each exactly once.
import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

/** App-absolute `path` (e.g. /items/aatrox) + optional Next sitemap fields. */
export type SeoRoute = { path: string } & Omit<MetadataRoute.Sitemap[number], 'url'>;

export async function seoRoutes(): Promise<SeoRoute[]> {
  // Only active shops: a paused store (Store.active=false) is already hidden
  // from its own public page and from ordering, so it must not be advertised
  // to crawlers either. `select` keeps this to two scalar columns — no image
  // bytes — so a 1,000-shop sitemap stays a few kilobytes.
  //
  // A database blip must not 500 the sitemap: the static nav pages are still
  // worth serving, so on failure we return [] and the callers fall back to
  // their curated lists. lastModified is the shop's own updatedAt, so a
  // catalogue edit is picked up on the next crawl.
  try {
    const stores = await prisma.store.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    return stores.map((store) => ({
      path: `/store/${store.slug}`,
      lastModified: store.updatedAt,
    }));
  } catch {
    return [];
  }
}
