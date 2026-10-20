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
  ChevronLeft,
  ChevronRight,
  Heart,
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
  SlidersHorizontal,
  Trash2,
  Wrench,
} from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { ShareSheet } from '@/components/custom/share-sheet';
import { ImageLightbox } from '@/components/custom/storefront/image-lightbox';
import { RecentlyViewed } from '@/components/custom/storefront/recently-viewed';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useLocalStorage } from '@/hooks/use-local-storage';
import {
  activeFilterCount,
  type CatalogFilters,
  type CatalogSort,
  DEFAULT_FILTERS,
  formatGhsInput,
  limitGroups,
  matchesFilters,
  matchesQuery,
  parseGhsInput,
  priceBounds,
  SORT_OPTIONS,
  sortItems,
} from '@/lib/catalog-view';
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

// Cards mounted per page. Enough to fill a few screens on a phone, small
// enough that a 500-item shop does not paint every image on first load.
const PAGE_SIZE = 24;
// How many "recently viewed" entries the device remembers.
const RECENT_LIMIT = 8;

type CatalogItem = StorePublic['items'][number];

/** Gallery URLs in display order; falls back to the legacy single cover. */
function itemPhotos(item: CatalogItem): string[] {
  if (item.images.length > 0) return item.images;
  return item.imageUrl ? [item.imageUrl] : [];
}

// The card's icon-only add affordance: a vector cart with a down arrow
// dropping into the basket. Drawn by hand so the arrow nests inside the same
// cart outline the rest of the storefront uses (lucide's geometry).
function CartArrowDown({ className }: { className?: string }) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative glyph; the button carries the label.
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
      <path d="M13 8.5v4" />
      <path d="M11 10.5 13 12.5 15 10.5" />
    </svg>
  );
}

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
          sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 25vw"
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
      {item.images.length > 1 ? (
        <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-1 text-caption font-semibold text-white backdrop-blur">
          {item.images.length} photos
        </span>
      ) : null}
    </span>
  );
}

// Swipeable gallery for the quick-view sheet: one big photo, arrows, a page
// counter, and thumbnails. Tapping the photo opens the fullscreen viewer at the
// photo currently shown.
function PhotoGallery({
  item,
  onImageClick,
}: {
  item: CatalogItem;
  onImageClick: (index: number) => void;
}) {
  const photos = itemPhotos(item);
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const active = Math.min(index, Math.max(0, photos.length - 1));
  const source = photos[active];

  function step(delta: number) {
    if (photos.length < 2) return;
    setIndex((active + delta + photos.length) % photos.length);
  }

  if (!source) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-muted">
        <span className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-muted-foreground">
          {item.kind === 'SERVICE' ? (
            <Wrench aria-hidden className="size-10" />
          ) : (
            <Package aria-hidden className="size-10" />
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div
        className="relative overflow-hidden rounded-xl border border-border bg-muted"
        onTouchStart={(event) => {
          touchX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchX.current;
          touchX.current = null;
          if (start == null) return;
          const end = event.changedTouches[0]?.clientX ?? start;
          if (Math.abs(end - start) > 40) step(end < start ? 1 : -1);
        }}
      >
        <button
          type="button"
          onClick={() => onImageClick(active)}
          aria-label={`View full image of ${item.name}`}
          className="group/photo relative block w-full"
        >
          <Image
            src={source}
            alt={`${item.name} — photo ${active + 1} of ${photos.length}`}
            width={1200}
            height={900}
            sizes="(max-width: 768px) 100vw, 640px"
            className="aspect-[4/3] w-full object-cover"
          />
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/70 py-1.5 pl-2 pr-2.5 text-caption font-semibold text-white backdrop-blur transition-colors group-hover/photo:bg-black/80">
            <Maximize2 aria-hidden className="size-3.5" />
            View
          </span>
        </button>
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => step(-1)}
              className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/65 text-white backdrop-blur transition-colors hover:bg-black/75"
            >
              <ChevronLeft aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => step(1)}
              className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/65 text-white backdrop-blur transition-colors hover:bg-black/75"
            >
              <ChevronRight aria-hidden className="size-4" />
            </button>
            <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-caption font-semibold text-white backdrop-blur">
              {active + 1} / {photos.length}
            </span>
          </>
        ) : null}
      </div>
      {photos.length > 1 ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {photos.map((photo, photoIndex) => (
            <button
              key={photo}
              type="button"
              aria-label={`Show photo ${photoIndex + 1} of ${photos.length}`}
              aria-current={photoIndex === active}
              onClick={() => setIndex(photoIndex)}
              className={cn(
                'relative size-14 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity',
                photoIndex === active
                  ? 'border-primary'
                  : 'border-transparent opacity-75 hover:opacity-100',
              )}
            >
              <Image
                src={photo}
                alt=""
                width={112}
                height={112}
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function StoreCatalog({
  storeName,
  storeSlug,
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
  /** Device-local memory (saved items, recently viewed) is scoped per shop. */
  storeSlug: string;
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
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [sort, setSort] = useState<CatalogSort>('featured');
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Paging is keyed to the current result set. Deriving `limit` instead of
  // resetting it in an effect means a new query renders from page one
  // immediately, without a frame of the previous, deeper page.
  const viewKey = [
    query,
    activeCategory ?? '',
    sort,
    filters.inStockOnly ? '1' : '0',
    filters.onSaleOnly ? '1' : '0',
    filters.savedOnly ? '1' : '0',
    filters.minPesewas ?? '',
    filters.maxPesewas ?? '',
  ].join('\u0000');
  const [paging, setPaging] = useState({ key: viewKey, limit: PAGE_SIZE });
  const limit = paging.key === viewKey ? paging.limit : PAGE_SIZE;
  const [savedIds, setSavedIds] = useLocalStorage<string[]>(`tilza:saved:${storeSlug}`, []);
  const [recentIds, setRecentIds] = useLocalStorage<string[]>(`tilza:recent:${storeSlug}`, []);

  const saved = new Set(savedIds);
  const filterCount = activeFilterCount(filters);
  const allItems = groups.flatMap((group) => group.items);
  const itemsById = new Map(allItems.map((item) => [item.id, item]));
  const recentItems = recentIds
    .map((id) => itemsById.get(id))
    .filter((item): item is CatalogItem => item != null)
    .slice(0, RECENT_LIMIT);
  const bounds = priceBounds(allItems);

  const categoryLabels = groups
    .map((group) => group.label)
    .filter((label): label is string => label !== null);
  const needle = query.trim().toLowerCase();
  const visibleGroups = groups
    .filter((group) => activeCategory === null || group.label === activeCategory)
    .map((group) => ({
      ...group,
      items: sortItems(
        group.items.filter(
          (item) => matchesQuery(item, needle, group.label) && matchesFilters(item, filters, saved),
        ),
        sort,
      ),
    }))
    .filter((group) => group.items.length > 0);
  const visibleCount = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);
  const totalCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  const filtering = needle !== '' || activeCategory !== null || filterCount > 0;
  const shownGroups = limitGroups(visibleGroups, limit);
  const shownCount = shownGroups.reduce((sum, group) => sum + group.items.length, 0);

  function toggleSaved(itemId: string) {
    setSavedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [itemId, ...current],
    );
  }

  function openQuickView(item: CatalogItem) {
    setQuickView(item);
    // Remember the visit even when the shopper only peeks at the card detail.
    setRecentIds((current) =>
      [item.id, ...current.filter((id) => id !== item.id)].slice(0, RECENT_LIMIT),
    );
  }

  function openLightbox(item: CatalogItem, index: number) {
    setLightboxIndex(index);
    setLightbox(item);
  }

  function patchFilters(patch: Partial<CatalogFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function clearFilters() {
    onQueryChange('');
    setActiveCategory(null);
    setFilters(DEFAULT_FILTERS);
    setSort('featured');
  }

  function emptyCopy() {
    const search = query.trim();
    if (filters.savedOnly && savedIds.length === 0) {
      return 'Nothing saved yet — tap the heart on an item to keep it here.';
    }
    if (search && activeCategory) return `Nothing matches “${search}” in ${activeCategory}.`;
    if (search) return `Nothing matches “${search}”.`;
    if (activeCategory) return `Nothing filed under ${activeCategory} yet.`;
    if (filterCount > 0) return 'Nothing matches those filters.';
    return 'Nothing matches those filters.';
  }

  function renderItem(item: CatalogItem) {
    const discount = itemDiscountPercent(item);
    const promos = promosForItem(promotions, item);
    const soldOut = item.stock != null && item.stock <= 0;
    const maxQty = item.stock ?? 99;
    const qty = cart[item.id] ?? 0;
    const isSaved = saved.has(item.id);

    return (
      <article
        key={item.id}
        id={item.id}
        className="group relative flex scroll-mt-36 flex-col rounded-lg border border-border bg-card transition-shadow hover:shadow-md"
      >
        <div className="relative overflow-hidden rounded-t-[7px]">
          <button
            type="button"
            onClick={() => openQuickView(item)}
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
          {/* Save first, share beneath: the heart is the frequent, one-tap
              action; sharing is deliberate. Both stay 32px so a thumb can hit
              them over the photo. */}
          <button
            type="button"
            onClick={() => toggleSaved(item.id)}
            aria-label={isSaved ? `Remove ${item.name} from saved` : `Save ${item.name}`}
            aria-pressed={isSaved}
            className={cn(
              'absolute right-2 top-2 grid size-8 place-items-center rounded-full backdrop-blur transition-colors',
              isSaved
                ? 'bg-white text-primary shadow-sm'
                : 'bg-black/35 text-white hover:bg-black/55',
            )}
          >
            <Heart aria-hidden className={cn('size-3.5', isSaved && 'fill-current')} />
          </button>
          <button
            type="button"
            onClick={() => setShareItem(item)}
            aria-label={`Share ${item.name}`}
            className="absolute right-2 top-12 grid size-8 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
          >
            <Share2 aria-hidden className="size-3.5" />
          </button>
          {item.imageUrl && (
            <button
              type="button"
              onClick={() => openLightbox(item, 0)}
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
            onClick={() => openQuickView(item)}
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
              <>
                {/* The icon-only add button straddles the card's bottom edge:
                    half sits on the card, half hangs into the row gap. The
                    spacer keeps the card as tall as the stepper state. */}
                <div aria-hidden className="h-10" />
                <button
                  type="button"
                  onClick={() => onQuantityChange(item.id, 1)}
                  aria-label={`Add ${item.name} to basket`}
                  className="absolute bottom-0 left-1/2 z-10 grid size-11 -translate-x-1/2 translate-y-1/2 place-items-center rounded-full bg-highlight text-highlight-foreground shadow-lg transition-colors hover:bg-flame-600"
                >
                  <CartArrowDown className="size-5" />
                </button>
              </>
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
      <div className="grid gap-6">
        <RecentlyViewed items={recentItems} onOpen={openQuickView} />

        {/* Toolbar: sort, filters and the saved view sit together above the
            rail so a shopper can narrow the catalogue without leaving it. The
            count on the right is the number of *matching* items, not the page. */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sort} onValueChange={(value) => setSort(value as CatalogSort)}>
            <SelectTrigger className="h-9 w-[180px] rounded-md text-small" aria-label="Sort items">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            onClick={() => setFiltersOpen(true)}
            className="h-9 gap-2 rounded-md px-3 text-small font-semibold"
          >
            <SlidersHorizontal aria-hidden className="size-4" />
            Filters
            {filterCount > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-caption font-bold text-primary-foreground">
                {filterCount}
              </span>
            )}
          </Button>

          <Button
            type="button"
            variant={filters.savedOnly ? 'default' : 'outline'}
            aria-pressed={filters.savedOnly}
            onClick={() => patchFilters({ savedOnly: !filters.savedOnly })}
            className="h-9 gap-2 rounded-md px-3 text-small font-semibold"
          >
            <Heart aria-hidden className={cn('size-4', filters.savedOnly && 'fill-current')} />
            Saved
            {savedIds.length > 0 && (
              <span className="text-caption font-medium opacity-80">{savedIds.length}</span>
            )}
          </Button>

          <p className="ml-auto text-caption font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {filtering ? `${visibleCount} of ${totalCount}` : totalCount}{' '}
            {totalCount === 1 ? 'item' : 'items'}
          </p>
        </div>

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
                            active
                              ? 'bg-highlight-foreground/15 text-highlight-foreground'
                              : 'bg-primary/10 text-highlight-ink',
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
                            active
                              ? 'bg-highlight-foreground/15 text-highlight-foreground'
                              : 'bg-primary/10 text-highlight-ink',
                          )}
                        >
                          <GroupIcon className="size-3.5" />
                        </span>
                      ) : (
                        <span
                          aria-hidden
                          className={cn(
                            'grid size-7 shrink-0 place-items-center rounded-full',
                            active
                              ? 'bg-highlight-foreground/15 text-highlight-foreground'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          <Package className="size-3.5" />
                        </span>
                      )}
                      {label ?? 'All items'}
                      <span
                        className={cn(
                          'text-caption font-medium',
                          active ? 'text-highlight-foreground/70' : 'text-muted-foreground',
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
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-highlight-ink">
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
          <>
            {shownGroups.map((group) => {
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
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-highlight-ink">
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
                  <div className="grid grid-cols-2 gap-x-3 gap-y-7 md:grid-cols-3 xl:grid-cols-4">
                    {group.items.map((item) => renderItem(item))}
                  </div>
                </section>
              );
            })}

            {/* Mount cards in pages. The count is what is *left*, so the
                label stays honest after a filter shrinks the result set. */}
            {shownCount < visibleCount && (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPaging({ key: viewKey, limit: limit + PAGE_SIZE })}
                  className="h-10 rounded-md px-6 text-small font-semibold"
                >
                  Load more ({visibleCount - shownCount} left)
                </Button>
              </div>
            )}
          </>
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
            className="max-h-[90vh] overflow-y-auto rounded-t-lg sm:mx-auto sm:w-[32rem]"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{quickView.name}</SheetTitle>
            </SheetHeader>
            <QuickViewBody
              key={quickView.id}
              item={quickView}
              storeName={storeName}
              contactPhone={contactPhone}
              promotions={promotions}
              qty={cart[quickView.id] ?? 0}
              saved={saved.has(quickView.id)}
              onToggleSaved={() => toggleSaved(quickView.id)}
              onQuantityChange={onQuantityChange}
              onShare={() => {
                setShareItem(quickView);
                setQuickView(null);
              }}
              onImageClick={(index) => {
                openLightbox(quickView, index);
                setQuickView(null);
              }}
            />
          </SheetContent>
        )}
      </Sheet>

      {/* Filters: one sheet, four facets. Price is a free band rather than
          preset buckets, because a shop's "cheap" is not another shop's. */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="bottom"
          aria-describedby={undefined}
          className="max-h-[88vh] overflow-y-auto rounded-t-lg sm:mx-auto sm:w-[28rem]"
        >
          <SheetHeader>
            <SheetTitle>Filter items</SheetTitle>
          </SheetHeader>
          <div className="grid gap-5 py-5">
            {/* Radix's checkbox is a button, not a native input, so the label
                is tied by id rather than by wrapping. */}
            <div className="flex items-center justify-between gap-4">
              <span id="filter-in-stock" className="text-small font-medium">
                In stock only
              </span>
              <Checkbox
                aria-labelledby="filter-in-stock"
                checked={filters.inStockOnly}
                onCheckedChange={(checked) => patchFilters({ inStockOnly: checked === true })}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span id="filter-on-sale" className="text-small font-medium">
                On sale only
              </span>
              <Checkbox
                aria-labelledby="filter-on-sale"
                checked={filters.onSaleOnly}
                onCheckedChange={(checked) => patchFilters({ onSaleOnly: checked === true })}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span id="filter-saved" className="text-small font-medium">
                Saved only
              </span>
              <Checkbox
                aria-labelledby="filter-saved"
                checked={filters.savedOnly}
                onCheckedChange={(checked) => patchFilters({ savedOnly: checked === true })}
              />
            </div>
            <div className="grid gap-2">
              <p className="text-caption font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Price (GH₵)
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder={bounds ? formatGhsInput(bounds.min) : 'Min'}
                  value={formatGhsInput(filters.minPesewas)}
                  onChange={(event) =>
                    patchFilters({ minPesewas: parseGhsInput(event.target.value) })
                  }
                  aria-label="Minimum price"
                  className="h-10 rounded-md"
                />
                <span className="text-small text-muted-foreground">to</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder={bounds ? formatGhsInput(bounds.max) : 'Max'}
                  value={formatGhsInput(filters.maxPesewas)}
                  onChange={(event) =>
                    patchFilters({ maxPesewas: parseGhsInput(event.target.value) })
                  }
                  aria-label="Maximum price"
                  className="h-10 rounded-md"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Button
              type="button"
              variant="outline"
              onClick={clearFilters}
              className="h-10 flex-1 rounded-md text-small font-semibold"
            >
              Clear all
            </Button>
            <Button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="h-10 flex-[2] rounded-md text-small font-semibold"
            >
              Show {visibleCount} {visibleCount === 1 ? 'item' : 'items'}
            </Button>
          </div>
        </SheetContent>
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
        src={lightbox ? (itemPhotos(lightbox)[lightboxIndex] ?? lightbox.imageUrl) : null}
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
  saved,
  onToggleSaved,
  onQuantityChange,
  onShare,
  onImageClick,
}: {
  item: CatalogItem;
  storeName: string;
  contactPhone: string | null;
  promotions: PromotionSummary[];
  qty: number;
  saved: boolean;
  onToggleSaved: () => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onShare: () => void;
  onImageClick: (index: number) => void;
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
      <PhotoGallery item={item} onImageClick={onImageClick} />

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
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onToggleSaved}
              aria-pressed={saved}
              className={cn(
                'inline-flex h-9 items-center justify-center gap-2 rounded-md border text-small font-medium transition-colors',
                saved
                  ? 'border-highlight/60 bg-highlight-wash text-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Heart
                aria-hidden
                className={cn('size-3.5', saved && 'fill-current text-highlight')}
              />
              {saved ? 'Saved' : 'Save for later'}
            </button>
            <button
              type="button"
              onClick={onShare}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border text-small font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Share2 aria-hidden className="size-3.5" /> Share
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
