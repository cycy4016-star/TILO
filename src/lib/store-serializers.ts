// Shared server-side serializers for the store API. Single source of truth so
// every route emits the same StorePayload/StoreItemRecord shape (including the
// hasLogo/hasImage flags that mirror whether an image is attached).
//
// Presence is read from the companion `*Mime` column — always written together
// with the bytes — so no list query ever selects the `bytea` image columns.
// Before this, /api/store and the public storefront loaded every photo in the
// shop into Node just to test `!= null`, which made every page view O(total
// photo bytes) in Postgres transfer alone.
import 'server-only';

import { Prisma } from '@prisma/client';
import { CategoryRecord } from '@/lib/contracts/category';
import { PromotionRecord } from '@/lib/contracts/promotion';
import { AppearanceKey, StoreItemRecord, StorePayload, ThemeKey } from '@/lib/contracts/store';
import { normalizeAppearance, normalizeTheme } from '@/lib/theme';

const ITEM_ORDER: Prisma.StoreItemOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { name: 'asc' },
];

const CATEGORY_ORDER: Prisma.ProductCategoryOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { name: 'asc' },
];

// Every scalar the contracts read, minus the bytea columns.
export const ITEM_SELECT = {
  id: true,
  storeId: true,
  categoryId: true,
  kind: true,
  name: true,
  description: true,
  pricePesewas: true,
  costPricePesewas: true,
  compareAtPricePesewas: true,
  sortOrder: true,
  active: true,
  imageMime: true,
  stock: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StoreItemSelect;

export const CATEGORY_SELECT = {
  id: true,
  storeId: true,
  name: true,
  sortOrder: true,
  active: true,
  icon: true,
  coverMime: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductCategorySelect;

// serializeCategory() reads itemCount from Prisma's `_count`, so every route
// that returns a category uses this variant.
export const CATEGORY_SELECT_WITH_COUNT = {
  ...CATEGORY_SELECT,
  _count: { select: { items: true } },
} satisfies Prisma.ProductCategorySelect;

export const PROMOTION_SELECT = {
  id: true,
  storeId: true,
  name: true,
  code: true,
  kind: true,
  value: true,
  minSubtotalPesewas: true,
  active: true,
  startsAt: true,
  endsAt: true,
  itemIds: true,
  categoryIds: true,
  imageMime: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PromotionSelect;

export const STORE_SELECT = {
  id: true,
  name: true,
  slug: true,
  tagline: true,
  description: true,
  promoBanner: true,
  contactPhone: true,
  active: true,
  theme: true,
  appearance: true,
  logoMime: true,
  bannerMime: true,
  createdAt: true,
  updatedAt: true,
  items: { orderBy: ITEM_ORDER, select: ITEM_SELECT },
  categories: { orderBy: CATEGORY_ORDER, select: CATEGORY_SELECT_WITH_COUNT },
} satisfies Prisma.StoreSelect;

// Canonical args every route must use when returning a StorePayload: without
// `categories` (and its item count) serializeStore() cannot parse the row.
// Built with Prisma.validator so spreading it into a find/create/update call
// still selects the right overload.
export const storeSelect = Prisma.validator<Prisma.StoreDefaultArgs>()({ select: STORE_SELECT });

// Row shapes: exactly what the selects above return — scalars + the *Mime
// presence flag, never the bytea columns.
export type StoreItemRow = {
  id: string;
  storeId: string;
  // Shelf heading, or null for an uncategorised item / one whose category
  // was deleted (the FK is SetNull).
  categoryId: string | null;
  kind: 'PRODUCT' | 'SERVICE';
  name: string;
  description: string | null;
  pricePesewas: number;
  costPricePesewas: number | null;
  compareAtPricePesewas: number | null;
  sortOrder: number;
  active: boolean;
  imageMime: string | null;
  stock: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryRow = {
  id: string;
  storeId: string;
  name: string;
  sortOrder: number;
  active: boolean;
  icon: string | null;
  coverMime: string | null;
  // Prisma `_count: { select: { items: true } }` — how many products sit here.
  _count?: { items: number };
  createdAt: Date;
  updatedAt: Date;
};

export type StoreRow = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  promoBanner: string | null;
  contactPhone: string | null;
  active: boolean;
  theme: string;
  appearance: string;
  logoMime: string | null;
  bannerMime: string | null;
  createdAt: Date;
  updatedAt: Date;
  categories: CategoryRow[];
  items: StoreItemRow[];
};

export type PromotionRow = {
  id: string;
  storeId: string;
  name: string;
  code: string | null;
  kind: 'PERCENT' | 'FIXED';
  value: number;
  minSubtotalPesewas: number | null;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  itemIds: string[];
  categoryIds: string[];
  imageMime: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeStoreItem(item: StoreItemRow) {
  return StoreItemRecord.parse({
    id: item.id,
    storeId: item.storeId,
    kind: item.kind,
    name: item.name,
    description: item.description,
    categoryId: item.categoryId,
    pricePesewas: item.pricePesewas,
    costPricePesewas: item.costPricePesewas,
    compareAtPricePesewas: item.compareAtPricePesewas,
    sortOrder: item.sortOrder,
    active: item.active,
    stock: item.stock,
    hasImage: item.imageMime != null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  });
}

// itemCount is read from Prisma's _count when the route includes it; a route
// that omits the count serialises a category as having zero products rather
// than failing the parse.
export function serializeCategory(category: CategoryRow) {
  return CategoryRecord.parse({
    id: category.id,
    storeId: category.storeId,
    name: category.name,
    sortOrder: category.sortOrder,
    active: category.active,
    icon: category.icon,
    hasCover: category.coverMime != null,
    itemCount: category._count?.items ?? 0,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  });
}

export function serializePromotion(promotion: PromotionRow) {
  return PromotionRecord.parse({
    id: promotion.id,
    storeId: promotion.storeId,
    name: promotion.name,
    code: promotion.code,
    kind: promotion.kind,
    value: promotion.value,
    minSubtotalPesewas: promotion.minSubtotalPesewas,
    active: promotion.active,
    startsAt: promotion.startsAt ? promotion.startsAt.toISOString() : null,
    endsAt: promotion.endsAt ? promotion.endsAt.toISOString() : null,
    itemIds: promotion.itemIds,
    categoryIds: promotion.categoryIds,
    hasImage: promotion.imageMime != null,
    createdAt: promotion.createdAt.toISOString(),
    updatedAt: promotion.updatedAt.toISOString(),
  });
}

export function serializeStore(store: StoreRow) {
  const theme = ThemeKey.parse(normalizeTheme(store.theme));
  const appearance = AppearanceKey.parse(normalizeAppearance(store.appearance));
  return StorePayload.parse({
    id: store.id,
    name: store.name,
    slug: store.slug,
    tagline: store.tagline,
    description: store.description,
    promoBanner: store.promoBanner,
    contactPhone: store.contactPhone,
    active: store.active,
    theme,
    appearance,
    hasLogo: store.logoMime != null,
    hasBanner: store.bannerMime != null,
    createdAt: store.createdAt.toISOString(),
    updatedAt: store.updatedAt.toISOString(),
    categories: store.categories.map(serializeCategory),
    items: store.items.map(serializeStoreItem),
  });
}
