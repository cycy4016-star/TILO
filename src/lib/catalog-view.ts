// Pure catalogue view logic for the public storefront.
//
// The storefront island keeps the *state* (search text, saved ids, sort key,
// filters) but every decision about what to show lives here, so the shelf
// rules are unit-tested without a DOM. Sorting is applied per shelf, not
// across the whole catalogue: shelves are the shop's own organisation and a
// price sort must not tear a shelf apart.
import { itemDiscountPercent } from '@/lib/promotions';

export type CatalogSort = 'featured' | 'price-asc' | 'price-desc' | 'discount' | 'newest';

export const SORT_OPTIONS: ReadonlyArray<{ value: CatalogSort; label: string }> = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'discount', label: 'Biggest discount' },
  { value: 'newest', label: 'Newest first' },
];

export type CatalogFilters = {
  /** Hide items whose tracked stock has reached zero. Untracked items count as in stock. */
  inStockOnly: boolean;
  /** Only items with a struck-through "was" price. Promo tags alone do not qualify. */
  onSaleOnly: boolean;
  /** Only items the shopper hearts on this device. */
  savedOnly: boolean;
  /** Inclusive price floor/ceiling in pesewas. Null = unbounded. */
  minPesewas: number | null;
  maxPesewas: number | null;
};

export const DEFAULT_FILTERS: CatalogFilters = {
  inStockOnly: false,
  onSaleOnly: false,
  savedOnly: false,
  minPesewas: null,
  maxPesewas: null,
};

/** The subset of a catalogue item this module needs to decide visibility. */
export type ViewItem = {
  id: string;
  name: string;
  description: string | null;
  pricePesewas: number;
  compareAtPricePesewas: number | null;
  stock: number | null;
  createdAt?: string | null;
};

/** Search covers the item, its description and the shelf it sits on. */
export function matchesQuery(
  item: Pick<ViewItem, 'name' | 'description'>,
  needle: string,
  categoryLabel: string | null,
): boolean {
  if (!needle) return true;
  return (
    item.name.toLowerCase().includes(needle) ||
    (item.description ?? '').toLowerCase().includes(needle) ||
    (categoryLabel ?? '').toLowerCase().includes(needle)
  );
}

export function isInStock(item: Pick<ViewItem, 'stock'>): boolean {
  return item.stock == null || item.stock > 0;
}

export function matchesFilters(
  item: ViewItem,
  filters: CatalogFilters,
  savedIds: ReadonlySet<string>,
): boolean {
  if (filters.inStockOnly && !isInStock(item)) return false;
  if (filters.onSaleOnly && itemDiscountPercent(item) == null) return false;
  if (filters.savedOnly && !savedIds.has(item.id)) return false;
  if (filters.minPesewas != null && item.pricePesewas < filters.minPesewas) return false;
  if (filters.maxPesewas != null && item.pricePesewas > filters.maxPesewas) return false;
  return true;
}

/** Cheapest and dearest price in the catalogue, or null when it is empty. */
export function priceBounds(items: ReadonlyArray<Pick<ViewItem, 'pricePesewas'>>): {
  min: number;
  max: number;
} | null {
  if (items.length === 0) return null;
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const item of items) {
    if (item.pricePesewas < min) min = item.pricePesewas;
    if (item.pricePesewas > max) max = item.pricePesewas;
  }
  return { min, max };
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Sort one shelf's items. `featured` preserves the server order, which is the
 * owner's `sortOrder` then name — the shop's own arrangement. Every other key
 * is stable on name so equal prices do not shuffle between renders.
 */
export function sortItems<T extends ViewItem>(items: readonly T[], sort: CatalogSort): T[] {
  const copy = [...items];
  switch (sort) {
    case 'price-asc':
      return copy.sort((a, b) => a.pricePesewas - b.pricePesewas || a.name.localeCompare(b.name));
    case 'price-desc':
      return copy.sort((a, b) => b.pricePesewas - a.pricePesewas || a.name.localeCompare(b.name));
    case 'discount':
      return copy.sort((a, b) => {
        const aOff = itemDiscountPercent(a) ?? -1;
        const bOff = itemDiscountPercent(b) ?? -1;
        return bOff - aOff || a.pricePesewas - b.pricePesewas || a.name.localeCompare(b.name);
      });
    case 'newest':
      return copy.sort(
        (a, b) => timestamp(b.createdAt) - timestamp(a.createdAt) || a.name.localeCompare(b.name),
      );
    default:
      return copy;
  }
}

/**
 * How many filter facets are doing something. The price band counts once even
 * when both ends are set, because it is one control to the shopper.
 */
export function activeFilterCount(filters: CatalogFilters): number {
  let count = 0;
  if (filters.inStockOnly) count += 1;
  if (filters.onSaleOnly) count += 1;
  if (filters.savedOnly) count += 1;
  if (filters.minPesewas != null || filters.maxPesewas != null) count += 1;
  return count;
}

/**
 * Cap how many cards are mounted: walk the shelves in order, take at most
 * `limit` items, and drop shelves that end up empty. Keeps a 500-item shop
 * from painting every card on first load.
 */
export function limitGroups<T, G extends { items: T[] }>(
  groups: ReadonlyArray<G>,
  limit: number,
): G[] {
  const out: G[] = [];
  let remaining = Math.max(0, Math.floor(limit));
  for (const group of groups) {
    if (remaining <= 0) break;
    const items = group.items.slice(0, remaining);
    if (items.length === 0) continue;
    remaining -= items.length;
    out.push({ ...group, items });
  }
  return out;
}

/** "GH₵ 12.50" → 1250. Empty or invalid input becomes null (unbounded). */
export function parseGhsInput(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (value.includes('-') || !cleaned) return null;
  const amount = Number.parseFloat(cleaned);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

/** 1250 → "12.5" for a price input (no trailing zeros, no currency symbol). */
export function formatGhsInput(pesewas: number | null): string {
  if (pesewas == null) return '';
  return String(Number((pesewas / 100).toFixed(2)));
}
