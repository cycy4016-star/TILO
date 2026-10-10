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
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12"
    >
      {/* Hero: deep tonal gradient with two soft blooms behind the content, so
          the shop's identity lands before a single product does. All colours
          come from the active theme's --tl ramp, so every preset re-skins this
          block without a single theme-specific class. */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--tl-950)] via-[var(--tl-900)] to-[var(--tl-700)] text-[var(--tl-50)] shadow-xl ring-1 ring-[var(--tl-950)]/40">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 -top-24 size-64 rounded-full bg-[var(--tl-400)]/25 blur-3xl sm:size-96" />
          <div className="absolute -bottom-32 -left-16 size-72 rounded-full bg-[var(--tl-500)]/20 blur-3xl sm:size-[28rem]" />
        </div>
        {store.bannerUrl && (
          <div className="relative h-56 w-full overflow-hidden bg-black/25 sm:h-72">
            <img
              src={store.bannerUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--tl-950)] via-[var(--tl-950)]/50 to-transparent"
            />
          </div>
        )}
        <div className="relative p-6 sm:p-12">
          {store.logoUrl && (
            <img
              src={store.logoUrl}
              alt=""
              className={`relative object-cover shadow-2xl ring-1 ring-white/30 ${
                store.bannerUrl
                  ? '-mt-24 mb-5 size-24 sm:-mt-28 sm:size-28 rounded-3xl'
                  : 'mb-5 size-20 rounded-3xl'
              }`}
            />
          )}
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-caption font-semibold text-[var(--tl-100)] ring-1 ring-white/15 backdrop-blur">
            <span aria-hidden className="size-1.5 rounded-full bg-emerald-400" />
            {store.items.length} {store.items.length === 1 ? 'item' : 'items'} · open for orders
          </p>
          <h1 className="mt-5 break-words font-display text-h1 tracking-tight text-[var(--tl-50)] lg:text-display">
            {store.name}
          </h1>
          {store.tagline && (
            <p className="mt-4 max-w-2xl text-body-lg text-[var(--tl-200)]">{store.tagline}</p>
          )}
          {store.description && (
            <p className="mt-2 max-w-2xl text-small text-[var(--tl-100)]/90">{store.description}</p>
          )}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {/* Deliberate exception to the gold-accent rule: WhatsApp actions
                keep the platform's own green, because "this opens a chat" is a
                stronger signal than brand consistency. See store-catalog's
                per-item WhatsApp button for the matching treatment. */}
            {chat && (
              <a
                href={chat}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-500 px-7 text-body font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-emerald-400 hover:shadow-emerald-500/30"
              >
                <MessageCircle aria-hidden className="size-4.5" /> Chat with us
              </a>
            )}
            <StoreShareButton
              storeName={store.name}
              tagline={store.tagline}
              storeUrl={`${siteUrl}/store/${slug}`}
            />
          </div>
        </div>
      </section>

      {store.promoBanner && (
        <section className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3.5 text-center text-small font-semibold text-foreground">
          <Tag aria-hidden className="size-4 shrink-0 text-primary" />
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
          <p className="text-eyebrow">Limited time</p>
          <h2 className="mt-2 break-words font-display text-h2 tracking-tight">
            Today&apos;s offers
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {store.promotions.map((promo) => {
              const terms = promoTerms(promo);
              return (
                <article
                  key={`${promo.name}-${promo.code ?? 'any'}`}
                  className="lift flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  {promo.imageUrl && (
                    <img
                      src={promo.imageUrl}
                      alt=""
                      className="mb-4 aspect-[16/9] w-full rounded-xl border border-border object-cover"
                    />
                  )}
                  <p className="font-display text-h4 text-primary">{promoHeadline(promo)}</p>
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
