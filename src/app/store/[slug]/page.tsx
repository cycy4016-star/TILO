// Public storefront — the "Jumia" face. Server-rendered (good for sharing),
// fed by the open /api/public/store/[slug] route. The catalogue itself is a
// client island (StoreCatalog) so one basket can span every card on the page.

import { MessageCircle, Phone, Tag } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LeadCaptureCard } from '@/components/custom/storefront/lead-capture-card';
import {
  CountdownText,
  FlashStrip,
  PromoShareButton,
  StoreShareButton,
} from '@/components/custom/storefront/promo-bits';
import { type CatalogGroup, StoreCatalog } from '@/components/custom/storefront/store-catalog';
import { StorePublic } from '@/lib/contracts/store';
import { env } from '@/lib/env';
import { waMeLink, waMessageLink } from '@/lib/phone';
import { formatPromoDate, promoHeadline, promoTerms } from '@/lib/promotions';
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

  const chat = waMessageLink(
    store.contactPhone,
    `Hi ${store.name}! I saw your shop online and I'd like to ask about ordering.`,
  );

  // One unified corporate storefront: appearance is always professional
  // (normalizeAppearance coerces every stored value).
  const groups = buildGroups(store.categories, store.items);

  return (
    <main
      data-theme={store.theme}
      data-appearance={store.appearance}
      className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14"
    >
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--tl-900)] via-[var(--tl-800)] to-[var(--tl-600)] text-[var(--tl-50)] shadow-md">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 85% 20%, rgb(250 204 21 / 0.3) 0, transparent 45%)',
          }}
        />
        {store.bannerUrl && (
          <div className="relative h-52 w-full overflow-hidden bg-black/20 sm:h-64">
            <img
              src={store.bannerUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--tl-900)]/70 to-transparent"
            />
          </div>
        )}
        <div className="relative p-5 sm:p-10">
          {store.logoUrl && (
            <img
              src={store.logoUrl}
              alt=""
              className={`relative bg-white object-cover shadow-xl ring-4 ring-white/90 ${
                store.bannerUrl
                  ? '-mt-20 mb-4 size-20 sm:-mt-24 sm:size-24 rounded-2xl'
                  : 'mb-4 size-16 rounded-2xl'
              }`}
            />
          )}
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--tl-100)] px-3 py-1 text-caption font-medium text-[var(--tl-900)]">
            {store.items.length} {store.items.length === 1 ? 'item' : 'items'} in the catalogue
          </p>
          <h1 className="mt-4 break-words font-display text-h1 text-[var(--tl-50)]">
            {store.name}
          </h1>
          {store.tagline && (
            <p className="mt-3 max-w-xl text-body-lg text-[var(--tl-200)]">{store.tagline}</p>
          )}
          {store.description && (
            <p className="mt-2 max-w-xl text-small text-[var(--tl-100)]">{store.description}</p>
          )}
          {/* Deliberate exception to the gold-accent rule: WhatsApp actions
              keep the platform's own green, because "this opens a chat" is a
              stronger signal than brand consistency. See store-catalog's
              per-item WhatsApp button for the matching treatment. */}
          {chat && (
            <a
              href={chat}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-emerald-600 px-6 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
            >
              <MessageCircle aria-hidden className="size-4" /> Chat with us
            </a>
          )}
          <div className="mt-3">
            <StoreShareButton
              storeName={store.name}
              tagline={store.tagline}
              storeUrl={`${siteUrl}/store/${slug}`}
            />
          </div>
        </div>
      </section>

      {store.promoBanner && (
        <section className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/60 px-4 py-3 text-center text-small font-medium text-muted-foreground">
          <Tag aria-hidden className="size-4 shrink-0" />
          <span>{store.promoBanner}</span>
        </section>
      )}

      {store.promotions.length > 0 && (
        <section className="mt-8">
          <FlashStrip
            promo={store.promotions.find((promo) => promo.endsAt) ?? null}
            storeUrl={`${siteUrl}/store/${slug}`}
            storeName={store.name}
          />
          <h2 className="break-words font-display text-h3">Today&apos;s offers</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {store.promotions.map((promo) => {
              const terms = promoTerms(promo);
              return (
                <article
                  key={`${promo.name}-${promo.code ?? 'any'}`}
                  className="flex flex-col rounded-2xl border border-border bg-card p-5"
                >
                  {promo.imageUrl && (
                    <img
                      src={promo.imageUrl}
                      alt=""
                      className="mb-3 aspect-[16/9] w-full rounded-2xl border border-border object-cover"
                    />
                  )}
                  <p className="text-h4 font-mono text-primary">{promoHeadline(promo)}</p>
                  <p className="mt-1 text-body font-semibold">{promo.name}</p>
                  {terms.length > 0 && (
                    <p className="mt-1 text-caption text-muted-foreground">{terms.join(' · ')}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {promo.code ? (
                      <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-caption font-medium text-primary">
                        CODE {promo.code}
                      </span>
                    ) : (
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-caption font-medium text-primary">
                        No code needed
                      </span>
                    )}
                    {promo.endsAt && new Date(promo.endsAt).getTime() > Date.now() ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-caption font-semibold text-destructive">
                        <CountdownText endsAt={promo.endsAt} />
                      </span>
                    ) : (
                      promo.endsAt && (
                        <span className="text-caption text-muted-foreground">
                          Ends {formatPromoDate(promo.endsAt)}
                        </span>
                      )
                    )}
                    <PromoShareButton
                      storeName={store.name}
                      promoName={promo.name}
                      headline={promoHeadline(promo)}
                      storeUrl={`${siteUrl}/store/${slug}`}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {store.items.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-border px-5 py-16 text-center">
          <p className="text-h4 font-display text-foreground">Restocking soon</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The catalogue is empty right now — check back in a moment.
          </p>
        </section>
      ) : (
        <StoreCatalog
          slug={slug}
          storeName={store.name}
          contactPhone={store.contactPhone}
          groups={groups}
          promotions={store.promotions}
          storeUrl={`${siteUrl}/store/${slug}`}
        />
      )}

      <LeadCaptureCard storeName={store.name} slug={slug} />

      {store.contactPhone && waMeLink(store.contactPhone) && (
        <p className="mt-8 flex items-center justify-center gap-2 text-center text-eyebrow">
          <Phone aria-hidden className="size-3.5" /> Orders land straight in the shop — WhatsApp,
          SMS or right here
        </p>
      )}
    </main>
  );
}
