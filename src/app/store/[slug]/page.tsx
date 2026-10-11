// Public storefront — the shop's marketplace face. Server-rendered shell that
// fetches the open /api/public/store/[slug] payload, buckets the catalogue by
// shelf, and hands both to the client Storefront, which owns the sticky
// masthead, hero, grid and basket on top of one shared state.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { type CatalogGroup, Storefront } from '@/components/custom/storefront/storefront';
import { StorePublic } from '@/lib/contracts/store';
import { env } from '@/lib/env';
import { siteUrl } from '@/lib/site';

type StorePageProps = { params: Promise<{ slug: string }> };

async function fetchStore(slug: string) {
  // Self-fetch through the canonical origin (BETTER_AUTH_URL) so the storefront
  // always talks to this deployment even under a proxy / on a custom domain.
  const res = await fetch(`${env.BETTER_AUTH_URL}/api/public/store/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return StorePublic.parse(await res.json());
}

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await fetchStore(slug);
  if (!store) return { title: 'Store not found' };
  return {
    title: store.name,
    description: store.tagline ?? store.description ?? `Order from ${store.name}.`,
  };
}

// Bucket the flat item list by shelf, in the same order the manager shows.
//
// A shop with no categories lands everything in one unlabelled group, so the
// page renders exactly as it did before shelves existed. Once categories are in
// play, anything the owner never filed gets an "Everything else" heading rather
// than sitting awkwardly under a named shelf.
function buildGroups(
  categories: StorePublic['categories'],
  items: StorePublic['items'],
): CatalogGroup[] {
  const buckets = [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((category) => ({
      id: category.id,
      label: category.name,
      icon: category.icon,
      coverUrl: category.coverUrl,
      items: [] as CatalogGroup['items'],
    }));
  const loose: CatalogGroup['items'] = [];
  for (const item of items) {
    const bucket = buckets.find((entry) => entry.id === item.categoryId);
    if (bucket) bucket.items.push(item);
    else loose.push(item);
  }
  const groups: CatalogGroup[] = buckets
    .filter((bucket) => bucket.items.length > 0)
    .map(({ label, icon, coverUrl, items: groupItems }) => ({
      label,
      icon,
      coverUrl,
      items: groupItems,
    }));
  if (loose.length > 0) {
    groups.push({
      label: groups.length > 0 ? 'Everything else' : null,
      icon: null,
      coverUrl: null,
      items: loose,
    });
  }
  return groups;
}

export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params;
  const store = await fetchStore(slug);
  if (!store) notFound();

  // One unified storefront: appearance is always professional
  // (normalizeAppearance coerces every stored value).
  const groups = buildGroups(store.categories, store.items);

  return <Storefront store={store} groups={groups} storeUrl={`${siteUrl}/store/${slug}`} />;
}
