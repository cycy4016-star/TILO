// Shared server-side serializers for the store API. Single source of truth so
// every route emits the same StorePayload/StoreItemRecord shape (including the
// hasLogo/hasImage flags that mirror whether image bytes exist in the DB).
import 'server-only';

import { PromotionRecord } from '@/lib/contracts/promotion';
import { StoreItemRecord, StorePayload } from '@/lib/contracts/store';

export type StoreItemRow = {
  id: string;
  storeId: string;
  kind: 'PRODUCT' | 'SERVICE';
  name: string;
  description: string | null;
  pricePesewas: number;
  compareAtPricePesewas: number | null;
  sortOrder: number;
  active: boolean;
  image: Uint8Array | null;
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
  logo: Uint8Array | null;
  createdAt: Date;
  updatedAt: Date;
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
  image: Uint8Array | null;
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
    pricePesewas: item.pricePesewas,
    compareAtPricePesewas: item.compareAtPricePesewas,
    sortOrder: item.sortOrder,
    active: item.active,
    hasImage: item.image != null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
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
    hasImage: promotion.image != null,
    createdAt: promotion.createdAt.toISOString(),
    updatedAt: promotion.updatedAt.toISOString(),
  });
}

export function serializeStore(store: StoreRow) {
  return StorePayload.parse({
    id: store.id,
    name: store.name,
    slug: store.slug,
    tagline: store.tagline,
    description: store.description,
    promoBanner: store.promoBanner,
    contactPhone: store.contactPhone,
    active: store.active,
    hasLogo: store.logo != null,
    createdAt: store.createdAt.toISOString(),
    updatedAt: store.updatedAt.toISOString(),
    items: store.items.map(serializeStoreItem),
  });
}
