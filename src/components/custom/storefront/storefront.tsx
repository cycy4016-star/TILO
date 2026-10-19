// The whole public storefront as one client shell: the sticky masthead, hero,
// trust strip, offers, catalogue, lead capture and checkout all share one
// basket and one search box, which is why they live under a single stateful
// owner instead of being stitched together across server/client boundaries.
// The server page hands over the parsed store payload and its grouped
// catalogue; everything visual is composed here. The shop wears the same
// white + blue + orange system as the rest of the platform — a store no longer
// picks its own palette, and the order button is the one orange moment.
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
      // scope to, so platform-specific rules can't leak between the public
      // shop and the workspace.
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
        {/* Hero. A white card with a hairline border — the same surface rule
            as every card in the product. It used to be a blue gradient with
            blurred colour blobs behind it; on a pure-white platform a hero has
            to earn its emphasis from the banner photo and the type, not from a
            painted background. The banner (when a shop has one) is the only
            large field of colour on the page. */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          {store.bannerUrl && (
            <div className="relative aspect-[2/1] w-full overflow-hidden bg-muted sm:aspect-[3/1]">
              <Image
                src={store.bannerUrl}
                alt=""
                fill
                priority
                sizes="(max-width: 640px) 100vw, 1152px"
                className="object-cover object-center"
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
                className={`relative bg-white object-contain p-1.5 ring-1 ring-border ${
                  store.bannerUrl
                    ? '-mt-20 mb-4 size-20 rounded-2xl sm:-mt-24 sm:size-24'
                    : 'mb-4 size-16 rounded-2xl'
                }`}
              />
            )}
            <p className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-caption font-semibold text-foreground">
              <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
              {store.items.length} {store.items.length === 1 ? 'item' : 'items'} · open for orders
            </p>
            <h1 className="mt-4 break-words font-display text-h1 tracking-tight text-foreground">
              {store.name}
            </h1>
            {store.tagline && (
              <p className="mt-3 max-w-2xl text-body-lg text-muted-foreground">{store.tagline}</p>
            )}
            {store.description && (
              <p className="mt-1.5 max-w-2xl text-small text-muted-foreground">
                {store.description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {/* The shop's highest-intent action, and the one place the energy
                  colour is load-bearing: orange fill, warm charcoal ink. The
                  WhatsApp icon carries the channel recognition — the button
                  itself stays inside the platform palette. */}
              {chat && (
                <a
                  href={chat}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-highlight px-6 text-small font-semibold text-highlight-foreground transition-colors hover:bg-flame-600"
                >
                  <MessageCircle aria-hidden className="size-4" /> Chat with us
                </a>
              )}
              <a
                href="#catalogue"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-background px-6 text-small font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Browse catalogue <ChevronDown aria-hidden className="size-4" />
              </a>
              <StoreShareButton
                storeName={store.name}
                tagline={store.tagline}
                storeUrl={storeUrl}
                className="border-border bg-background text-foreground hover:bg-muted"
              />
            </div>
          </div>
        </section>

        {store.promoBanner && (
          <section className="flex items-center justify-center gap-2 rounded-xl border border-flame-200 bg-highlight-wash px-4 py-3 text-center text-small font-semibold text-foreground">
            <Tag aria-hidden className="size-4 shrink-0 text-highlight" />
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
              Tilza
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
