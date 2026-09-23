// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  StoreItemCreate,
  StoreItemUpdate,
  StorePayload,
  StorePublic,
  StoreUpsert,
} from '@/lib/contracts/store';

const storePayload = {
  id: 'store-1',
  name: "Ama's Boutique",
  slug: 'amas-boutique',
  tagline: 'Printed gear, made loud',
  description: 'Custom prints in Accra.',
  promoBanner: null,
  contactPhone: '024 000 0000',
  active: true,
  hasLogo: false,
  createdAt: '2026-09-21T00:00:00.000Z',
  updatedAt: '2026-09-21T00:00:00.000Z',
  items: [
    {
      id: 'item-1',
      storeId: 'store-1',
      kind: 'PRODUCT' as const,
      name: 'Branded apron',
      description: 'One colour',
      pricePesewas: 4550,
      costPricePesewas: null,
      compareAtPricePesewas: null,
      sortOrder: 0,
      active: true,
      hasImage: false,
      createdAt: '2026-09-21T00:00:00.000Z',
      updatedAt: '2026-09-21T00:00:00.000Z',
    },
  ],
};

describe('store contracts', () => {
  it('accepts a well-formed store and rejects a bad link word', () => {
    expect(
      StoreUpsert.safeParse({
        name: "Ama's Boutique",
        slug: 'amas-boutique',
        contactPhone: '024 000 0000',
        active: true,
      }).success,
    ).toBe(true);
    expect(StoreUpsert.safeParse({ name: "Ama's Boutique", slug: 'Amas Boutique' }).success).toBe(
      false,
    );
    expect(StoreUpsert.safeParse({ name: '', slug: 'amas' }).success).toBe(false);
  });

  it('keeps prices whole, in pesewas', () => {
    expect(StoreItemCreate.safeParse({ name: 'Apron', pricePesewas: 45.5 }).success).toBe(false);
    expect(StoreItemCreate.safeParse({ name: 'Apron', pricePesewas: -100 }).success).toBe(false);
    expect(
      StoreItemCreate.safeParse({
        name: 'Apron',
        kind: 'SERVICE',
        pricePesewas: 4550,
      }).success,
    ).toBe(true);
  });

  it('accepts a sale ("was") price, and rejects nonsense ones', () => {
    expect(
      StoreItemCreate.safeParse({ name: 'Apron', pricePesewas: 45, compareAtPricePesewas: 90 })
        .success,
    ).toBe(true);
    expect(
      StoreItemCreate.safeParse({ name: 'Apron', pricePesewas: 45, compareAtPricePesewas: -9 })
        .success,
    ).toBe(false);
    expect(StoreItemUpdate.safeParse({ compareAtPricePesewas: null }).success).toBe(true);
  });

  it('parses the manager payload with items', () => {
    expect(StorePayload.safeParse(storePayload).success).toBe(true);
  });

  it('strips ids from the public storefront', () => {
    const result = StorePublic.safeParse({
      name: storePayload.name,
      slug: storePayload.slug,
      tagline: storePayload.tagline,
      description: storePayload.description,
      promoBanner: null,
      contactPhone: storePayload.contactPhone,
      logoUrl: null,
      items: [
        {
          id: 'item-1',
          kind: 'PRODUCT',
          name: 'Branded apron',
          description: null,
          pricePesewas: 4550,
          compareAtPricePesewas: null,
          imageUrl: null,
        },
      ],
      promotions: [],
    });
    expect(result.success).toBe(true);
    const items = result.success ? result.data.items : [];
    expect(items[0]).not.toHaveProperty('storeId');
  });
});
