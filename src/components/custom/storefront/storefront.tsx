// The whole public storefront as one client shell: the sticky masthead, hero,
// trust strip, offers, catalogue, lead capture and checkout all share one
// basket and one search box, which is why they live under a single stateful
// owner instead of being stitched together across server/client boundaries.
// The server page hands over the parsed store payload and its grouped
// catalogue; everything visual is composed here. The shop wears the platform's
// warm marketplace system — white surfaces, orange prices and one bright
// add-to-basket moment.
'use client';

import {
  ArrowUpRight,
  BadgeCheck,
  Boxes,
  ChevronDown,
  MessageCircle,
  RotateCcw,
  Tag,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { TilzaLogo } from '@/components/custom/tilza-logo';
import { Button } from '@/components/ui/button';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { type LastOrder, lastOrderMemoryKey } from '@/lib/checkout-memory';
import { formatGhs } from '@/lib/contracts/order';
import type { StorePublic } from '@/lib/contracts/store';
import { waMeLink, waMessageLink } from '@/lib/phone';
import { formatPromoDate, promoHeadline, promoTerms } from '@/lib/promotions';

export type { CatalogGroup } from '@/components/custom/storefront/store-catalog';

type CatalogItem = CatalogGroup['items'][number];

function formatOrderDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium' }).format(date);
}

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
  // Recent searches are device-local and per shop: the header suggests them
  // while the field is empty, so a returning shopper retypes nothing.
  const [recentSearches, setRecentSearches] = useLocalStorage<string[]>(
    `tilza:search:${store.slug}`,
    [],
  );
  const [lastOrder, setLastOrder] = useLocalStorage<LastOrder | null>(
    lastOrderMemoryKey(store.slug),
    null,
  );

  function rememberSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((current) =>
      [trimmed, ...current.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(
        0,
        6,
      ),
    );
  }

  const searchSuggestions = groups
    .filter((group): group is CatalogGroup & { label: string } => group.label !== null)
    .map((group) => ({ label: group.label, count: group.items.length }));

  const allItems: CatalogItem[] = groups.flatMap((group) => group.items);
  const lines = allItems.filter((item) => (cart[item.id] ?? 0) > 0);
  const count = lines.reduce((sum, item) => sum + (cart[item.id] ?? 0), 0);
  const total = lines.reduce((sum, item) => sum + item.pricePesewas * (cart[item.id] ?? 0), 0);

  const repeatLines = (lastOrder?.lines ?? []).flatMap((line) => {
    const item = allItems.find((entry) => entry.id === line.itemId);
    if (!item || (item.stock != null && item.stock <= 0)) return [];
    const quantity = Math.min(Math.max(1, line.quantity), item.stock ?? 99, 99);
    return [{ item, quantity }];
  });
  const repeatTotal = repeatLines.reduce(
    (sum, line) => sum + line.item.pricePesewas * line.quantity,
    0,
  );
  const missingRepeatLines = (lastOrder?.lines.length ?? 0) - repeatLines.length;

  function orderAgain() {
    setCart((current) => {
      const next = { ...current };
      for (const line of repeatLines) {
        next[line.item.id] = Math.max(next[line.item.id] ?? 0, line.quantity);
      }
      return next;
    });
    if (missingRepeatLines > 0) {
      toast.success('Added what is still available to your basket');
    }
    setCheckoutOpen(true);
  }

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
        suggestions={searchSuggestions}
        recentSearches={recentSearches}
        onSubmitQuery={rememberSearch}
        onClearRecent={() => setRecentSearches([])}
        cartCount={count}
        onCartOpen={openBasket}
      />

      <div
        className={`mx-auto grid w-full max-w-6xl gap-6 px-4 pt-6 sm:pt-8 ${
          count > 0 ? 'pb-28' : 'pb-16'
        }`}
      >
        {/* Shop front. A banner when the owner has one, then a compact identity
            block with the shop's name, what it sells and the one high-intent
            action. Kept tight so products are visible on the first screen. */}
        <section className="overflow-hidden rounded-xl border border-border bg-card">
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
          <div className="p-4 sm:p-6">
            <div className="flex items-start gap-3.5 sm:gap-5">
              {store.logoUrl ? (
                <Image
                  src={store.logoUrl}
                  alt=""
                  width={512}
                  height={512}
                  sizes="(max-width: 640px) 64px, 80px"
                  className="size-16 shrink-0 rounded-lg bg-white object-contain p-1 ring-1 ring-border sm:size-20"
                />
              ) : (
                <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-highlight font-display text-h2 font-bold text-highlight-foreground sm:size-20">
                  {store.name.trim().charAt(0).toUpperCase() || 'S'}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="inline-flex items-center gap-1.5 rounded bg-highlight-wash px-2 py-1 text-caption font-bold text-highlight-ink">
                  <BadgeCheck aria-hidden className="size-3.5" />
                  Open for orders
                </p>
                <h1 className="mt-2 break-words font-display text-h2 tracking-tight text-foreground sm:text-h1">
                  {store.name}
                </h1>
                {store.tagline && (
                  <p className="mt-1 line-clamp-2 text-small font-medium text-muted-foreground sm:text-body">
                    {store.tagline}
                  </p>
                )}
              </div>
            </div>

            {store.description && (
              <p className="mt-3 max-w-3xl text-small text-muted-foreground sm:mt-4">
                {store.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {chat && (
                <a
                  href={chat}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-small font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <MessageCircle aria-hidden className="size-4" /> Chat with us
                </a>
              )}
              <a
                href="#catalogue"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-small font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                <Boxes aria-hidden className="size-4" /> Shop all
                <ChevronDown aria-hidden className="size-3.5" />
              </a>
              <StoreShareButton
                storeName={store.name}
                tagline={store.tagline}
                storeUrl={storeUrl}
                className="border-border bg-card text-foreground hover:bg-muted"
              />
            </div>
          </div>
        </section>

        {lastOrder && repeatLines.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-eyebrow">Welcome back</p>
                <p className="mt-1 font-display text-h4">Order again</p>
                <p className="mt-1 text-small text-muted-foreground">
                  {formatOrderDate(lastOrder.placedAt)
                    ? `Your last order from ${formatOrderDate(lastOrder.placedAt)}`
                    : 'Your last order'}
                  {missingRepeatLines > 0
                    ? ` · ${missingRepeatLines} ${missingRepeatLines === 1 ? 'item is' : 'items are'} no longer available`
                    : ''}
                </p>
                {lastOrder.trackingUrl && (
                  <a
                    href={lastOrder.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-caption font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    Track last order <ArrowUpRight aria-hidden className="size-3" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={orderAgain}
                  className="h-10 gap-2 rounded-md px-4 font-semibold"
                >
                  <RotateCcw aria-hidden className="size-4" /> Add to basket
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Dismiss previous order"
                  onClick={() => setLastOrder(null)}
                  className="size-10 rounded-md text-muted-foreground"
                >
                  <X aria-hidden className="size-4" />
                </Button>
              </div>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {repeatLines.map(({ item, quantity }) => (
                <li key={item.id} className="rounded bg-muted px-2.5 py-1 text-caption font-medium">
                  <span className="font-mono">{quantity}x</span> {item.name}
                </li>
              ))}
              <li className="rounded bg-highlight-wash px-2.5 py-1 text-caption font-bold text-highlight-ink">
                {formatGhs(repeatTotal)}
              </li>
            </ul>
          </section>
        )}

        {store.promoBanner && (
          <section className="flex items-center justify-center gap-2 rounded-lg bg-highlight px-4 py-3 text-center text-small font-bold text-highlight-foreground">
            <Tag aria-hidden className="size-4 shrink-0" />
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
            <div className="flex items-end justify-between gap-3 border-b border-border pb-2">
              <div>
                <p className="text-eyebrow">Limited time</p>
                <h2 className="mt-1 break-words font-display text-h2 tracking-tight">
                  Today&apos;s offers
                </h2>
              </div>
              <span className="shrink-0 rounded bg-destructive/10 px-2 py-1 text-caption font-bold text-destructive">
                Save more
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {store.promotions.map((promo) => {
                const terms = promoTerms(promo);
                return (
                  <article
                    key={`${promo.name}-${promo.code ?? 'any'}`}
                    className="lift flex flex-col overflow-hidden rounded-lg border border-border bg-card"
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
                          <span className="rounded bg-highlight-wash px-2.5 py-1 font-mono text-caption font-bold text-highlight-ink">
                            CODE {promo.code}
                          </span>
                        ) : (
                          <span className="rounded bg-highlight-wash px-2.5 py-1 text-caption font-bold text-highlight-ink">
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
            <div className="grid gap-5">
              <div className="flex items-end justify-between gap-3 border-b border-border pb-2">
                <div>
                  <p className="text-eyebrow">Catalogue</p>
                  <h2 className="mt-1 break-words font-display text-h2 tracking-tight">Shop all</h2>
                </div>
                <span className="shrink-0 text-caption font-semibold text-muted-foreground">
                  {allItems.length} {allItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <StoreCatalog
                storeName={store.name}
                storeSlug={store.slug}
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
          <p className="flex items-center justify-center gap-2 text-center text-caption font-semibold text-muted-foreground">
            <MessageCircle aria-hidden className="size-3.5 text-primary" /> Orders land straight in
            the shop — WhatsApp, SMS or right here
          </p>
        )}

        {/* The marketing footer steps aside on /store, so the shop gets a slim
            footer of its own: who you're buying from, and a quiet way back. */}
        <footer className="mt-4 border-t border-border py-8 text-center">
          <p className="font-display text-h4">{store.name}</p>
          <p className="mt-1 text-caption text-muted-foreground">
            Powered by{' '}
            <a
              href="/"
              aria-label="Tilza"
              className="inline-flex items-center align-[-0.2em] text-highlight-ink transition-opacity hover:opacity-80"
            >
              <TilzaLogo className="text-small" />
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
          <p className="mt-2 text-caption">
            <a
              href="/signup"
              className="font-semibold text-highlight-ink underline underline-offset-2"
            >
              Open your own shop on Tilza →
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
        address={store.address}
        lat={store.lat}
        lng={store.lng}
        slug={store.slug}
        theme={store.theme}
        lines={lines}
        cart={cart}
        total={total}
        promotions={store.promotions}
        onQuantityChange={setQuantity}
        onPlaced={(order) => {
          setLastOrder(order);
          setCart({});
        }}
      />
    </main>
  );
}
