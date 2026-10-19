// The public storefront's catalogue grid.
//
// A client island so one basket can span every card on the page — the server
// page hands over already-grouped shelves (label = category name, null =
// uncategorised) and the storefront shell owns the search/basket state that
// this grid renders against. Marketplace styling: roomy 2×3-up cards, square
// photos, price-first type, one-tap add — with quick-view, WhatsApp and SMS
// tucked behind the sheet so the card stays clean. A photo can be tapped
// straight into a fullscreen lightbox (grid "View" pill or the quick-view
// photo) so the whole, uncropped image is one tap away.
'use client';

import {
  Maximize2,
  MessageCircle,
  MessageSquareText,
  Minus,
  Package,
  Percent,
  Plus,
  Search,
  Share2,
  ShoppingCart,
  Trash2,
  Wrench,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { ShareSheet } from '@/components/custom/share-sheet';
import { ImageLightbox } from '@/components/custom/storefront/image-lightbox';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CATEGORY_ICONS } from '@/lib/category-icons';
import { formatGhs } from '@/lib/contracts/order';
import type { PromotionSummary } from '@/lib/contracts/promotion';
import type { StorePublic } from '@/lib/contracts/store';
import { smsLink, waMessageLink } from '@/lib/phone';
import { itemDiscountPercent, promosForItem } from '@/lib/promotions';
import { productShareMessage } from '@/lib/share';
import { orderRequestSms } from '@/lib/sms-templates';
import { cn } from '@/lib/utils';
import { itemOrderWhatsApp } from '@/lib/whatsapp-templates';

type CatalogItem = StorePublic['items'][number];

// One shelf as the server hands it over. `label: null` is the uncategorised
// bucket (or a shop with no categories at all) — those render without a heading
// so a shop that never sets one up looks exactly as it did before.
export type CatalogGroup = {
  label: string | null;
  icon: string | null;
  coverUrl: string | null;
  items: CatalogItem[];
};

const kindLabels: Record<'PRODUCT' | 'SERVICE', string> = {
  PRODUCT: 'Product',
  SERVICE: 'Service',
};

// Text search covers the item itself and the shelf it sits on, so typing a
// category name brings back everything filed under it.
function matches(item: CatalogItem, needle: string, category: string | null): boolean {
  if (!needle) return true;
  return (
    item.name.toLowerCase().includes(needle) ||
    (item.description ?? '').toLowerCase().includes(needle) ||
    (category ?? '').toLowerCase().includes(needle)
  );
}

// Photo with a shimmer underneath: the card keeps its shape on a slow network
// and the image fades in over the skeleton instead of popping.
function CardMedia({ item }: { item: CatalogItem }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span
      className={cn(
        'relative block aspect-square w-full overflow-hidden bg-muted',
        !loaded && 'animate-pulse',
      )}
    >
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          sizes="(max-width: 767px) 50vw, 33vw"
          onLoad={() => setLoaded(true)}
          className={cn(
            'object-cover transition-transform duration-500 ease-out-expo group-hover:scale-105',
            !loaded && 'opacity-0',
          )}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
          {item.kind === 'SERVICE' ? (
            <Wrench aria-hidden className="size-9" />
          ) : (
            <Package aria-hidden className="size-9" />
          )}
        </span>
      )}
    </span>
  );
}

export function StoreCatalog({
  storeName,
  contactPhone,
  groups,
  promotions,
  storeUrl,
  theme,
  query,
  onQueryChange,
  cart,
  onQuantityChange,
}: {
  storeName: string;
  contactPhone: string | null;
  groups: CatalogGroup[];
  promotions: PromotionSummary[];
  storeUrl: string;
  /** Shop theme key — the quick-view sheet is portaled outside the themed
   *  <main>, so it re-scopes the tokens on itself to stay in the shop's skin. */
  theme: string;
  query: string;
  onQueryChange: (value: string) => void;
  cart: Record<string, number>;
  onQuantityChange: (itemId: string, quantity: number) => void;
}) {
  // Filtering only hides cards — the basket always spans the whole catalogue,
  // so narrowing the view never drops what's already in it.
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [shareItem, setShareItem] = useState<CatalogItem | null>(null);
  const [quickView, setQuickView] = useState<CatalogItem | null>(null);
  const [lightbox, setLightbox] = useState<CatalogItem | null>(null);

  const categoryLabels = groups
    .map((group) => group.label)
    .filter((label): label is string => label !== null);
  const needle = query.trim().toLowerCase();
  const visibleGroups = groups
    .filter((group) => activeCategory === null || group.label === activeCategory)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => matches(item, needle, group.label)),
    }))
    .filter((group) => group.items.length > 0);
  const visibleCount = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);
  const totalCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  const filtering = needle !== '' || activeCategory !== null;

  function clearFilters() {
    onQueryChange('');
    setActiveCategory(null);
  }

  function emptyCopy() {
    const search = query.trim();
    if (search && activeCategory) return `Nothing matches “${search}” in ${activeCategory}.`;
    if (search) return `Nothing matches “${search}”.`;
    if (activeCategory) return `Nothing filed under ${activeCategory} yet.`;
    return 'Nothing matches those filters.';
  }

  function renderItem(item: CatalogItem) {
    const discount = itemDiscountPercent(item);
    const promos = promosForItem(promotions, item);
    const soldOut = item.stock != null && item.stock <= 0;
    const maxQty = item.stock ?? 99;
    const qty = cart[item.id] ?? 0;

    return (
      <article
        key={item.id}
        id={item.id}
        className="group flex scroll-mt-36 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-md"
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => setQuickView(item)}
            aria-label={`Quick view ${item.name}`}
            className="block w-full"
          >
            <CardMedia item={item} />
          </button>
          {(discount != null || promos.length > 0 || soldOut) && (
            <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
              {soldOut ? (
                <span className="rounded bg-[var(--tl-950)]/80 px-2 py-1 text-caption font-bold uppercase tracking-wide text-white backdrop-blur">
                  Sold out
                </span>
              ) : (
                discount != null && (
                  <span className="inline-flex items-center gap-1 rounded bg-destructive px-2 py-1 text-caption font-bold text-white shadow-sm">
                    <Percent aria-hidden className="size-3" />
                    {discount}% off
                  </span>
                )
              )}
              {promos.map((promo) => (
                <span
                  key={promo.name}
                  className="rounded bg-[var(--tl-950)]/70 px-2 py-1 text-caption font-semibold text-white backdrop-blur"
                >
                  {promo.name}
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShareItem(item)}
            aria-label={`Share ${item.name}`}
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
          >
            <Share2 aria-hidden className="size-3.5" />
          </button>
          {item.imageUrl && (
            <button
              type="button"
              onClick={() => setLightbox(item)}
              aria-label={`View full image of ${item.name}`}
              className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/45 py-1.5 pl-2 pr-2.5 text-caption font-semibold text-white backdrop-blur transition-colors hover:bg-black/65"
            >
              <Maximize2 aria-hidden className="size-3.5" />
              View
            </button>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3">
          <button
            type="button"
            onClick={() => setQuickView(item)}
            className="text-left"
            aria-label={`Quick view ${item.name}`}
          >
            <h3 className="line-clamp-2 text-small font-medium leading-snug transition-colors group-hover:text-primary">
              {item.name}
            </h3>
          </button>
          {item.kind === 'SERVICE' && (
            <span className="mt-1 w-fit rounded bg-muted px-1.5 py-0.5 text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              {kindLabels[item.kind]}
            </span>
          )}
          <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
            <span className="font-display text-h4 leading-none text-primary">
              {formatGhs(item.pricePesewas)}
            </span>
            {discount != null && (
              <span className="text-caption text-muted-foreground line-through">
                {formatGhs(item.compareAtPricePesewas ?? 0)}
              </span>
            )}
          </div>
          {!soldOut && item.stock != null && item.stock > 0 && item.stock <= 5 && (
            <p className="mt-1 text-caption font-semibold text-destructive">
              Only {item.stock} left
            </p>
          )}

          <div className="mt-3 pt-1">
            {soldOut ? (
              <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-center text-caption text-muted-foreground">
                Back soon — message the shop to reserve one.
              </p>
            ) : qty === 0 ? (
              <Button
                type="button"
                onClick={() => onQuantityChange(item.id, 1)}
                className="h-10 w-full items-center gap-2 rounded-md bg-highlight px-3 font-semibold text-highlight-foreground shadow-sm hover:bg-flame-600 active:scale-[0.98]"
              >
                <ShoppingCart aria-hidden className="size-4" /> Add to basket
              </Button>
            ) : (
              <div className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1 py-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`One fewer ${item.name}`}
                  onClick={() => onQuantityChange(item.id, qty - 1)}
                  className="size-8 rounded"
                >
                  <Minus aria-hidden className="size-3.5" />
                </Button>
                <span className="min-w-6 text-center font-mono text-small font-bold">{qty}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`One more ${item.name}`}
                  onClick={() => onQuantityChange(item.id, Math.min(maxQty, qty + 1))}
                  className="size-8 rounded"
                >
                  <Plus aria-hidden className="size-3.5" />
                </Button>
                <button
                  type="button"
                  aria-label={`Remove ${item.name} from the basket`}
                  onClick={() => onQuantityChange(item.id, 0)}
                  className="ml-auto grid size-8 place-items-center rounded text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <>
      <div className="grid gap-8">
        {/* Category rail: one chip per shelf with its cover, marketplace-style.
            Hidden when the shop has nothing to rail (zero or one shelf). */}
        {categoryLabels.length > 1 && (
          <nav aria-label="Categories" className="-mx-4 overflow-x-auto px-4">
            <ul className="flex min-w-max gap-2.5">
              {[null, ...categoryLabels].map((label) => {
                const group = groups.find((entry) => entry.label === label);
                const active = activeCategory === label;
                const GroupIcon = group?.icon ? (CATEGORY_ICONS[group.icon] ?? null) : null;
                return (
                  <li key={label ?? '__all'}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setActiveCategory(label)}
                      className={cn(
                        'flex items-center gap-2 rounded-full border py-2 pl-2 pr-3.5 text-small font-semibold transition-all',
                        active
                          ? 'border-transparent bg-highlight text-highlight-foreground shadow-sm'
                          : 'border-border bg-card text-foreground hover:border-primary/50 hover:text-primary',
                      )}
                    >
                      {label === null ? (
                        <span
                          aria-hidden
                          className={cn(
                            'grid size-7 shrink-0 place-items-center rounded-full',
                            active ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary',
                          )}
                        >
                          <Search className="size-3.5" />
                        </span>
                      ) : group?.coverUrl ? (
                        <Image
                          src={group.coverUrl}
                          alt=""
                          width={400}
                          height={400}
                          sizes="28px"
                          className="size-7 shrink-0 rounded-full bg-muted object-cover"
                        />
                      ) : GroupIcon ? (
                        <span
                          aria-hidden
                          className={cn(
                            'grid size-7 shrink-0 place-items-center rounded-full',
                            active ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary',
                          )}
                        >
                          <GroupIcon className="size-3.5" />
                        </span>
                      ) : (
                        <span
                          aria-hidden
                          className={cn(
                            'grid size-7 shrink-0 place-items-center rounded-full',
                            active ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          <Package className="size-3.5" />
                        </span>
                      )}
                      {label ?? 'All items'}
                      <span
                        className={cn(
                          'text-caption font-medium',
                          active ? 'text-white/80' : 'text-muted-foreground',
                        )}
                      >
                        {label === null ? totalCount : (group?.items.length ?? 0)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        {filtering && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-caption font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {visibleCount} of {totalCount} {totalCount === 1 ? 'item' : 'items'}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="text-small font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
            >
              Clear filters
            </button>
          </div>
        )}

        {visibleGroups.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-5 py-16 text-center shadow-xs">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Search aria-hidden className="size-5" />
            </span>
            <p className="mt-4 font-display text-h3 tracking-tight">No matches</p>
            <p className="mt-1 text-small text-muted-foreground">{emptyCopy()}</p>
            <Button
              type="button"
              variant="outline"
              onClick={clearFilters}
              className="mt-5 h-10 rounded-md px-4 text-small font-semibold"
            >
              Clear search &amp; filters
            </Button>
          </div>
        ) : (
          visibleGroups.map((group) => {
            const GroupIcon = group.icon ? (CATEGORY_ICONS[group.icon] ?? null) : null;
            return (
              <section key={group.label ?? '__uncategorised'}>
                {group.label && (
                  <div className="mb-4 flex items-end justify-between gap-4 border-b border-border pb-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {group.coverUrl ? (
                        <Image
                          src={group.coverUrl}
                          alt=""
                          width={400}
                          height={400}
                          sizes="44px"
                          className="size-11 shrink-0 rounded-xl border border-border bg-muted object-cover shadow-xs"
                        />
                      ) : (
                        GroupIcon && (
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <GroupIcon aria-hidden className="size-5" />
                          </span>
                        )
                      )}
                      <h2 className="break-words font-display text-h2 tracking-tight">
                        {group.label}
                      </h2>
                    </div>
                    <span className="shrink-0 text-caption font-semibold text-muted-foreground">
                      {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {group.items.map((item) => renderItem(item))}
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* Quick view: the full product story without leaving the grid — photo,
          description, quantity, and the per-item WhatsApp/SMS order links. */}
      <Sheet
        open={quickView !== null}
        onOpenChange={(open) => {
          if (!open) setQuickView(null);
        }}
      >
        {quickView && (
          <SheetContent
            side="bottom"
            data-theme={theme}
            aria-describedby={undefined}
            className="max-h-[90vh] overflow-y-auto rounded-t-2xl sm:max-w-lg"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{quickView.name}</SheetTitle>
            </SheetHeader>
            <QuickViewBody
              item={quickView}
              storeName={storeName}
              contactPhone={contactPhone}
              promotions={promotions}
              qty={cart[quickView.id] ?? 0}
              onQuantityChange={onQuantityChange}
              onShare={() => {
                setShareItem(quickView);
                setQuickView(null);
              }}
              onImageClick={() => {
                setLightbox(quickView);
                setQuickView(null);
              }}
            />
          </SheetContent>
        )}
      </Sheet>

      {shareItem && (
        <ShareSheet
          open={shareItem !== null}
          onOpenChange={(next) => {
            if (!next) setShareItem(null);
          }}
          title={`Share “${shareItem.name}”`}
          description="Send this product anywhere — WhatsApp carries the price and link."
          message={productShareMessage({
            storeName,
            itemName: shareItem.name,
            priceLabel: formatGhs(shareItem.pricePesewas),
            itemUrl: `${storeUrl}#${shareItem.id}`,
          })}
          url={`${storeUrl}#${shareItem.id}`}
          imageUrl={`/api/public/store/items/${shareItem.id}/share`}
          imageName={`${shareItem.name}-share.png`}
        />
      )}

      <ImageLightbox
        open={lightbox !== null}
        onOpenChange={(open) => {
          if (!open) setLightbox(null);
        }}
        src={lightbox?.imageUrl ?? null}
        alt={lightbox?.name ?? ''}
      />
    </>
  );
}

function QuickViewBody({
  item,
  storeName,
  contactPhone,
  promotions,
  qty,
  onQuantityChange,
  onShare,
  onImageClick,
}: {
  item: CatalogItem;
  storeName: string;
  contactPhone: string | null;
  promotions: PromotionSummary[];
  qty: number;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onShare: () => void;
  onImageClick: () => void;
}) {
  const discount = itemDiscountPercent(item);
  const promos = promosForItem(promotions, item);
  const soldOut = item.stock != null && item.stock <= 0;
  const lowStock = item.stock != null && item.stock > 0 && item.stock <= 5;
  const maxQty = item.stock ?? 99;
  const discountLabel =
    discount != null
      ? `${formatGhs(item.pricePesewas)}, was ${formatGhs(item.compareAtPricePesewas ?? 0)} (${discount}% off)`
      : formatGhs(item.pricePesewas);
  const wa = contactPhone
    ? waMessageLink(
        contactPhone,
        itemOrderWhatsApp({
          storeName,
          itemName: item.name,
          priceLabel: discountLabel,
          quantity: Math.max(1, qty),
        }),
      )
    : null;
  const sms = contactPhone
    ? smsLink(
        contactPhone,
        orderRequestSms({
          storeName,
          itemName: item.name,
          priceGhs: formatGhs(item.pricePesewas),
          quantity: Math.max(1, qty),
        }),
      )
    : null;

  return (
    <div className="grid gap-4">
      {item.imageUrl ? (
        <button
          type="button"
          onClick={onImageClick}
          aria-label={`View full image of ${item.name}`}
          className="group/photo relative block overflow-hidden rounded-xl border border-border bg-muted"
        >
          <Image
            src={item.imageUrl}
            alt={item.name}
            width={1200}
            height={900}
            sizes="(max-width: 768px) 100vw, 640px"
            className="aspect-[4/3] w-full object-cover"
          />
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/45 py-1.5 pl-2 pr-2.5 text-caption font-semibold text-white backdrop-blur transition-colors group-hover/photo:bg-black/65">
            <Maximize2 aria-hidden className="size-3.5" />
            View
          </span>
        </button>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-muted">
          <span className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-muted-foreground">
            {item.kind === 'SERVICE' ? (
              <Wrench aria-hidden className="size-10" />
            ) : (
              <Package aria-hidden className="size-10" />
            )}
          </span>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-muted px-2 py-0.5 text-caption font-semibold uppercase tracking-wide text-muted-foreground">
            {kindLabels[item.kind]}
          </span>
          {soldOut ? (
            <span className="rounded bg-muted px-2 py-0.5 text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Sold out
            </span>
          ) : (
            lowStock && (
              <span className="rounded bg-destructive/10 px-2 py-0.5 text-caption font-semibold uppercase tracking-wide text-destructive">
                Only {item.stock} left
              </span>
            )
          )}
          {promos.map((promo) => (
            <span
              key={promo.name}
              className="rounded bg-[var(--tl-950)]/70 px-2 py-0.5 text-caption font-semibold text-white"
            >
              {promo.name}
            </span>
          ))}
        </div>
        <h3 className="mt-2 break-words font-display text-h3 tracking-tight">{item.name}</h3>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="font-display text-h3 text-primary">{formatGhs(item.pricePesewas)}</span>
          {discount != null && (
            <span className="text-small text-muted-foreground line-through">
              {formatGhs(item.compareAtPricePesewas ?? 0)}
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-3 max-w-[60ch] text-small leading-relaxed text-muted-foreground">
            {item.description}
          </p>
        )}
      </div>

      {soldOut ? (
        <p className="rounded-md border border-dashed border-border px-4 py-3 text-center text-small text-muted-foreground">
          Back soon — message the shop to reserve one.
        </p>
      ) : (
        <div className="grid gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-caption font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Quantity
            </span>
            <div className="ml-auto flex items-center gap-1 rounded-md border border-border bg-card px-1 py-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`One fewer ${item.name}`}
                disabled={qty === 0}
                onClick={() => onQuantityChange(item.id, qty - 1)}
                className="size-8 rounded"
              >
                <Minus aria-hidden className="size-3.5" />
              </Button>
              <span className="min-w-7 text-center font-mono text-small font-bold">{qty}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`One more ${item.name}`}
                onClick={() => onQuantityChange(item.id, Math.min(maxQty, Math.max(1, qty + 1)))}
                className="size-8 rounded"
              >
                <Plus aria-hidden className="size-3.5" />
              </Button>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => onQuantityChange(item.id, Math.min(maxQty, Math.max(1, qty + 1)))}
            className="h-11 items-center gap-2 rounded-md bg-highlight font-semibold text-highlight-foreground shadow-sm hover:bg-flame-600 active:scale-[0.98]"
          >
            <ShoppingCart aria-hidden className="size-4" />
            {qty === 0 ? 'Add to basket' : `Add ${qty} more to basket`}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-small font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
              >
                <MessageCircle aria-hidden className="size-4" /> WhatsApp
              </a>
            )}
            {sms && (
              <a
                href={sms}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-4 text-small font-semibold transition-colors hover:bg-muted"
              >
                <MessageSquareText aria-hidden className="size-4" /> SMS
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex h-9 items-center justify-center gap-2 text-small font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Share2 aria-hidden className="size-3.5" /> Share this product
          </button>
        </div>
      )}
    </div>
  );
}
