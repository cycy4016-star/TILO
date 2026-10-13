// The whole public storefront as one client shell: the sticky masthead, hero,
// trust strip, offers, catalogue, lead capture and checkout all share one
// basket and one search box, which is why they live under a single stateful
// owner instead of being stitched together across server/client boundaries.
// The server page hands over the parsed store payload and its grouped
// catalogue; everything visual is composed here, skinned by the shop's own
// theme (data-theme on <main> recolours every token below it).
'use client';

import { ChevronDown, MessageCircle, Tag } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { BasketBar } from '@/components/custom/storefront/basket-bar';
import { CheckoutDialog } from '@/components/custom/storefront/checkout-dialog';
import { LeadCaptureCard } from '@/components/custom/storefront/lead-capture-card';
import {
  CountdownText,
  FlashStrip,
  PromoShareButton,
  StoreShareButton,
} from '@/components/custom/storefront/promo-bits';
import { type CatalogGroup, StoreCatalog } from '@/components/custom/storefront/store-catalog';
import { StoreHeader } from '@/components/custom/storefront/store-header';
import { TrustStrip } from '@/components/custom/storefront/trust-strip';
import type { StorePublic } from '@/lib/contracts/store';
import { waMeLink, waMessageLink } from '@/lib/phone';
import { formatPromoDate, promoHeadline, promoTerms } from '@/lib/promotions';

export type { CatalogGroup } from '@/components/custom/storefront/store-catalog';

type CatalogItem = CatalogGroup['items'][number];

export function Storefront({
  store,
  groups,
  storeUrl,
}: {
  store: StorePublic;
  groups: CatalogGroup[];
  storeUrl: string;
}) {
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const allItems: CatalogItem[] = groups.flatMap((group) => group.items);
  const lines = allItems.filter((item) => (cart[item.id] ?? 0) > 0);
  const count = lines.reduce((sum, item) => sum + (cart[item.id] ?? 0), 0);
  const total = lines.reduce((sum, item) => sum + item.pricePesewas * (cart[item.id] ?? 0), 0);

  function setQuantity(itemId: string, quantity: number) {
    setCart((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[itemId];
      else next[itemId] = quantity;
      return next;
    });
  }

  function openBasket() {
    if (count > 0) setCheckoutOpen(true);
    else document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
  }

  const chat = store.contactPhone
    ? waMessageLink(
        store.contactPhone,
        `Hi ${store.name}! I saw your shop online and I'd like to ask about ordering.`,
      )
    : null;

  return (
    <main
      id="top"
      // Mirrors the dashboard's data-platform="app": a stable hook CSS can
      // scope to. The public shop is themed per-store (data-theme below), so
      // platform-specific rules must not leak into the workspace or vice versa.
      data-platform="store"
      data-theme={store.theme}
      data-appearance={store.appearance}
      className="min-h-screen bg-background text-foreground"
    >
      <StoreHeader
        storeName={store.name}
        logoUrl={store.logoUrl}
        query={query}
        onQueryChange={setQuery}
        cartCount={count}
        onCartOpen={openBasket}
      />

      <div
        className={`mx-auto grid w-full max-w-6xl gap-6 px-4 pt-6 sm:pt-8 ${
          count > 0 ? 'pb-28' : 'pb-16'
        }`}
      >
        {/* Hero: the shop's identity on its own theme ramp — banner photo
            behind, logo and name in front, one chat CTA and one jump to the
            catalogue. */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--tl-950)] via-[var(--tl-900)] to-[var(--tl-700)] text-[var(--tl-50)] shadow-lg ring-1 ring-[var(--tl-950)]/30">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-20 -top-24 size-64 rounded-full bg-[var(--tl-400)]/20 blur-3xl sm:size-96" />
            <div className="absolute -bottom-32 -left-16 size-72 rounded-full bg-[var(--tl-500)]/15 blur-3xl sm:size-[28rem]" />
          </div>
          {store.bannerUrl && (
            <div className="relative h-44 w-full overflow-hidden bg-black/25 sm:h-60">
              <Image
                src={store.bannerUrl}
                alt=""
                fill
                priority
                sizes="(max-width: 72rem) 100vw, 1152px"
                className="object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--tl-950)] via-[var(--tl-950)]/50 to-transparent"
              />
            </div>
          )}
          <div className="relative p-6 sm:p-10">
            {store.logoUrl && (
              <Image
                src={store.logoUrl}
                alt=""
                width={512}
                height={512}
                sizes="(max-width: 640px) 80px, 96px"
                className={`relative object-cover shadow-xl ring-1 ring-white/25 ${
                  store.bannerUrl
                    ? '-mt-20 mb-4 size-20 sm:-mt-24 sm:size-24 rounded-2xl'
                    : 'mb-4 size-16 rounded-2xl'
                }`}
              />
            )}
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-caption font-semibold text-[var(--tl-100)] ring-1 ring-white/15 backdrop-blur">
              <span aria-hidden className="size-1.5 rounded-full bg-emerald-400" />
              {store.items.length} {store.items.length === 1 ? 'item' : 'items'} · open for orders
            </p>
            <h1 className="mt-4 break-words font-display text-h1 tracking-tight text-[var(--tl-50)]">
              {store.name}
            </h1>
            {store.tagline && (
              <p className="mt-3 max-w-2xl text-body-lg text-[var(--tl-200)]">{store.tagline}</p>
            )}
            {store.description && (
              <p className="mt-1.5 max-w-2xl text-small text-[var(--tl-100)]/90">
                {store.description}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {/* Deliberate exception to the accent rule: WhatsApp actions keep
                  the platform's own green, because "this opens a chat" is a
                  stronger signal than brand consistency. */}
              {chat && (
                <a
                  href={chat}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-500 px-6 text-small font-semibold text-white shadow-lg shadow-emerald-900/25 transition-colors hover:bg-emerald-400"
                >
                  <MessageCircle aria-hidden className="size-4" /> Chat with us
                </a>
              )}
              <a
                href="#catalogue"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-white/10 px-6 text-small font-semibold text-[var(--tl-50)] ring-1 ring-white/20 backdrop-blur transition-colors hover:bg-white/20"
              >
                Browse catalogue <ChevronDown aria-hidden className="size-4" />
              </a>
              <StoreShareButton
                storeName={store.name}
                tagline={store.tagline}
                storeUrl={storeUrl}
                className="border-white/25 bg-white/5 text-[var(--tl-50)] hover:bg-white/15 hover:text-white"
              />
            </div>
          </div>
        </section>

        {store.promoBanner && (
          <section className="flex items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-center text-small font-semibold">
            <Tag aria-hidden className="size-4 shrink-0 text-primary" />
            <span>{store.promoBanner}</span>
          </section>
        )}

        <TrustStrip />

        {store.promotions.length > 0 && (
          <section className="grid gap-4">
            <FlashStrip
              promo={store.promotions.find((promo) => promo.endsAt) ?? null}
              storeUrl={storeUrl}
              storeName={store.name}
            />
            <div>
              <p className="text-eyebrow">Limited time</p>
              <h2 className="mt-1 break-words font-display text-h2 tracking-tight">
                Today&apos;s offers
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {store.promotions.map((promo) => {
                const terms = promoTerms(promo);
                return (
                  <article
                    key={`${promo.name}-${promo.code ?? 'any'}`}
                    className="lift flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs"
                  >
                    {promo.imageUrl && (
                      <Image
                        src={promo.imageUrl}
                        alt=""
                        width={1200}
                        height={675}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="aspect-[16/9] w-full border-b border-border object-cover"
                      />
                    )}
                    <div className="flex flex-1 flex-col p-4">
                      <p className="text-eyebrow">{promoHeadline(promo)}</p>
                      <p className="mt-1 font-display text-h4">{promo.name}</p>
                      {terms.length > 0 && (
                        <p className="mt-1 text-caption text-muted-foreground">
                          {terms.join(' · ')}
                        </p>
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
                          storeUrl={storeUrl}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section id="catalogue" className="scroll-mt-24">
          {allItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-5 py-16 text-center">
              <p className="font-display text-h4">Restocking soon</p>
              <p className="mt-1 text-small text-muted-foreground">
                The catalogue is empty right now — check back in a moment.
              </p>
            </div>
          ) : (
            <div className="grid gap-8">
              <div>
                <p className="text-eyebrow">Catalogue</p>
                <h2 className="mt-1 break-words font-display text-h2 tracking-tight">
                  Everything on sale
                </h2>
              </div>
              <StoreCatalog
                storeName={store.name}
                contactPhone={store.contactPhone}
                groups={groups}
                promotions={store.promotions}
                storeUrl={storeUrl}
                theme={store.theme}
                query={query}
                onQueryChange={setQuery}
                cart={cart}
                onQuantityChange={setQuantity}
              />
            </div>
          )}
        </section>

        <LeadCaptureCard storeName={store.name} slug={store.slug} />

        {store.contactPhone && waMeLink(store.contactPhone) && (
          <p className="flex items-center justify-center gap-2 text-center text-eyebrow">
            <MessageCircle aria-hidden className="size-3.5" /> Orders land straight in the shop —
            WhatsApp, SMS or right here
          </p>
        )}

        {/* The marketing footer steps aside on /store, so the shop gets a slim
            footer of its own: who you're buying from, and a quiet way back. */}
        <footer className="mt-4 border-t border-border py-8 text-center">
          <p className="font-display text-h4">{store.name}</p>
          <p className="mt-1 text-caption text-muted-foreground">
            Powered by{' '}
            <a href="/" className="font-medium text-primary underline underline-offset-2">
              Tilo
            </a>{' '}
            ·{' '}
            <a href="/privacy" className="underline underline-offset-2">
              Privacy
            </a>{' '}
            ·{' '}
            <a href="/terms" className="underline underline-offset-2">
              Terms
            </a>
          </p>
        </footer>
      </div>

      <BasketBar count={count} total={total} onCheckout={() => setCheckoutOpen(true)} />

      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        storeName={store.name}
        contactPhone={store.contactPhone}
        slug={store.slug}
        theme={store.theme}
        lines={lines}
        cart={cart}
        total={total}
        onQuantityChange={setQuantity}
        onPlaced={() => setCart({})}
      />
    </main>
  );
}
