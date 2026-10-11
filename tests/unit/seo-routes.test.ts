// @vitest-environment node
//
// The storefront SEO feed: every active shop is a public /store/[slug] page
// that should be indexed. Guards the three things that could silently break
// crawlability — an inactive shop leaking into the sitemap, a database blip
// 500-ing /sitemap.xml, and the query pulling image bytes it only needs
// `slug`/`updatedAt` for.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  prisma: { store: { findMany: vi.fn() } },
}));

vi.mock('@/lib/db', () => db);
vi.mock('server-only', () => ({}));

const { seoRoutes } = await import('@/lib/seo-routes');

const T = new Date('2026-10-01T00:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.store.findMany.mockResolvedValue([]);
});

describe('seoRoutes', () => {
  it('maps each active shop to a /store/[slug] path with its updatedAt', async () => {
    db.prisma.store.findMany.mockResolvedValue([
      { slug: 'phone-hub', updatedAt: T },
      { slug: 'amas-kitchen', updatedAt: T },
    ]);

    await expect(seoRoutes()).resolves.toEqual([
      { path: '/store/phone-hub', lastModified: T },
      { path: '/store/amas-kitchen', lastModified: T },
    ]);
  });

  it('filters to active shops only', () => {
    // A paused shop is already hidden from its own page and from ordering, so
    // it must not be advertised to crawlers either.
    seoRoutes();
    expect(db.prisma.store.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
  });

  it('selects only slug/updatedAt so image bytes never ride along', () => {
    // The sitemap is re-fetched by crawlers; loading logo/banner bytes for
    // every shop would make it megabytes for no reason.
    seoRoutes();
    expect(db.prisma.store.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { slug: true, updatedAt: true } }),
    );
  });

  it('falls back to [] on a database error so static pages still serve', async () => {
    // /sitemap.xml and /llms.txt merge this into curated nav pages; a blip
    // must not take the whole document down.
    db.prisma.store.findMany.mockRejectedValue(new Error('P1001 unreachable'));
    await expect(seoRoutes()).resolves.toEqual([]);
  });
});
