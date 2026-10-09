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
  // (normalizeAppearance coerces every stored value), so the loud branch
  // below never renders — kept only as dead-safe markup until cleanup.
  const pro = true;
  const groups = buildGroups(store.categories, store.items);

  return (
    <main
      data-theme={store.theme}
      data-appearance={store.appearance}
      className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14"
    >
      <section
        className={`relative overflow-hidden ${pro ? 'rounded-3xl' : 'rounded-[2rem]'} bg-gradient-to-br shadow-md ${
          pro
            ? 'from-[var(--tl-900)] via-[var(--tl-800)] to-[var(--tl-600)]'
            : 'from-amber-950 via-[#78350f] to-yellow-600'
        } ${pro ? 'text-[var(--tl-50)]' : 'text-amber-50'}`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: pro
              ? 'radial-gradient(circle at 85% 20%, rgb(250 204 21 / 0.3) 0, transparent 45%)'
              : 'radial-gradient(circle at 85% 20%, #facc15 0, transparent 35%), radial-gradient(circle at 10% 90%, #fcd34d 0, transparent 30%)',
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
              className={`absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t ${
                pro ? 'from-[var(--tl-900)]/70' : 'from-amber-950/70'
              } to-transparent`}
            />
          </div>
        )}
        <div className="relative p-5 sm:p-10">
          {store.logoUrl && (
            <img
              src={store.logoUrl}
              alt=""
              className={`relative bg-white object-cover shadow-xl ring-4 ${
                pro ? 'ring-white/90' : 'ring-amber-50/90'
              } ${
                store.bannerUrl
                  ? '-mt-20 mb-4 size-20 sm:-mt-24 sm:size-24 rounded-2xl'
                  : 'mb-4 size-16 rounded-2xl'
              }`}
            />
          )}
          <p
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
              pro
                ? 'text-caption font-medium bg-[var(--tl-100)] text-[var(--tl-900)]'
                : 'text-[0.7rem] font-semibold uppercase tracking-[0.18em] rotate-1 bg-amber-300 font-black text-amber-950'
            }`}
          >
            {store.items.length} {store.items.length === 1 ? 'item' : 'items'}{' '}
            {pro ? 'in the catalogue' : 'on the shelf'}
          </p>
          <h1
            className={`mt-4 break-words ${
              pro
                ? 'font-display text-h1 text-[var(--tl-50)]'
                : 'leading-none sm:text-6xl font-display text-4xl font-black uppercase text-amber-50'
            }`}
          >
            {store.name}
          </h1>
          {store.tagline && (
            <p
              className={`mt-3 max-w-xl ${
                pro ? 'text-body-lg text-[var(--tl-200)]' : 'text-lg font-bold text-amber-100'
              }`}
            >
              {store.tagline}
            </p>
          )}
          {store.description && (
            <p
              className={`mt-2 max-w-xl ${
                pro
                  ? 'text-small text-[var(--tl-100)]'
                  : 'text-sm font-medium leading-relaxed text-amber-200/90'
              }`}
            >
              {store.description}
            </p>
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
              className={`mt-6 inline-flex h-11 items-center gap-2 bg-emerald-600 px-6 text-white shadow-sm transition-colors hover:bg-emerald-500 ${
                pro ? 'rounded-md font-semibold' : 'rounded-full font-bold uppercase tracking-wide'
              }`}
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
        <section
          className={`mt-6 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-center ${
            pro
              ? 'border border-border bg-muted/60 text-small font-medium text-muted-foreground'
              : 'rounded-2xl border-2 border-[var(--tl-cta-border)] bg-[var(--tl-banner)] font-display text-sm font-black uppercase tracking-wide text-amber-900 dark:border-amber-700 dark:bg-stone-900 dark:text-amber-300'
          }`}
        >
          <Tag aria-hidden className="size-4 shrink-0" />
          <span>{store.promoBanner}</span>
        </section>
      )}

      {store.promotions.length > 0 && (
        <section className="mt-8">
          <FlashStrip
            pro={pro}
            promo={store.promotions.find((promo) => promo.endsAt) ?? null}
            storeUrl={`${siteUrl}/store/${slug}`}
            storeName={store.name}
          />
          <h2
            className={`break-words ${
              pro ? 'font-display text-h3' : 'text-2xl font-bold font-display font-black uppercase'
            }`}
          >
            Today&apos;s offers
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {store.promotions.map((promo, index) => {
              const terms = promoTerms(promo);
              return (
                <article
                  key={`${promo.name}-${promo.code ?? 'any'}-${index}`}
                  className={`flex flex-col ${
                    pro
                      ? // border-border: a warm --tl-200 hairline reads as a
                        // selection outline once the card goes dark.
                        'rounded-2xl border border-border bg-card p-5'
                      : `border-2 bg-white dark:bg-stone-900 rounded-[1.75rem] border-amber-950 p-5 shadow-[5px_5px_0_0_#451a03] ${
                          index % 2 === 1 ? 'rotate-[0.5deg]' : '-rotate-[0.5deg]'
                        }`
                  }`}
                >
                  {promo.imageUrl && (
                    <img
                      src={promo.imageUrl}
                      alt=""
                      className={`mb-3 aspect-[16/9] w-full rounded-2xl object-cover ${
                        pro
                          ? 'border border-border'
                          : 'border-2 border-amber-100 dark:border-stone-800'
                      }`}
                    />
                  )}
                  <p
                    className={`${
                      pro
                        ? 'text-h4 font-mono text-primary'
                        : 'font-mono text-2xl font-black text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {promoHeadline(promo)}
                  </p>
                  <p
                    className={`mt-1 ${
                      pro
                        ? 'text-body font-semibold'
                        : 'font-display font-black uppercase tracking-tight'
                    }`}
                  >
                    {promo.name}
                  </p>
                  {terms.length > 0 && (
                    <p
                      className={
                        pro
                          ? 'mt-1 text-caption text-muted-foreground'
                          : 'mt-1 text-xs font-medium text-stone-500'
                      }
                    >
                      {terms.join(' · ')}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {promo.code ? (
                      <span
                        className={`rounded-full px-3 py-1 font-mono ${
                          pro
                            ? 'text-caption font-medium bg-primary/10 text-primary'
                            : 'text-xs tracking-widest bg-amber-100 font-black text-amber-800 dark:bg-stone-800 dark:text-amber-300'
                        }`}
                      >
                        CODE {promo.code}
                      </span>
                    ) : (
                      <span
                        className={
                          pro
                            ? 'rounded-full bg-primary/10 px-3 py-1 text-caption font-medium text-primary'
                            : 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }
                      >
                        No code needed
                      </span>
                    )}
                    {promo.endsAt && new Date(promo.endsAt).getTime() > Date.now() ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                          pro
                            ? 'bg-destructive/10 text-caption text-destructive'
                            : 'bg-red-600 text-[0.65rem] uppercase tracking-wider text-white'
                        }`}
                      >
                        <CountdownText endsAt={promo.endsAt} />
                      </span>
                    ) : (
                      promo.endsAt && (
                        <span
                          className={
                            pro
                              ? 'text-caption text-muted-foreground'
                              : 'text-xs font-medium text-stone-400'
                          }
                        >
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
        <section
          className={`mt-8 rounded-2xl border-dashed px-5 py-16 text-center ${
            pro ? 'border border-border' : 'border-2 border-amber-400'
          }`}
        >
          <p
            className={
              pro
                ? 'text-h4 font-display text-foreground'
                : 'text-xl font-bold font-display font-black uppercase'
            }
          >
            Restocking soon
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pro
              ? 'The catalogue is empty right now — check back in a moment.'
              : 'The shelf is empty right now — check back in a moment.'}
          </p>
        </section>
      ) : (
        <StoreCatalog
          slug={slug}
          storeName={store.name}
          contactPhone={store.contactPhone}
          pro={pro}
          groups={groups}
          promotions={store.promotions}
          storeUrl={`${siteUrl}/store/${slug}`}
        />
      )}

      <LeadCaptureCard storeName={store.name} slug={slug} />

      {store.contactPhone && waMeLink(store.contactPhone) && (
        <p
          className={`mt-8 flex items-center justify-center gap-2 text-center ${
            pro ? 'text-eyebrow' : 'text-xs font-semibold uppercase tracking-widest text-primary'
          }`}
        >
          <Phone aria-hidden className="size-3.5" /> Orders land straight in the shop — WhatsApp,
          SMS or right here
        </p>
      )}
    </main>
  );
}
