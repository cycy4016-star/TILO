// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validateWizardStep, type WizardState } from '@/components/custom/item-wizard';
import { isCategoryIcon } from '@/lib/category-icons';
import { countdownParts, promosForItem } from '@/lib/promotions';
import {
  productShareMessage,
  promoShareMessage,
  shareTargetFor,
  shareUrlWithRef,
  shopShareMessage,
} from '@/lib/share';

function state(overrides: Partial<WizardState> = {}): WizardState {
  return {
    name: '',
    kind: 'PRODUCT',
    photo: null,
    photoPreview: null,
    photoBlur: null,
    categoryId: null,
    newCategoryName: '',
    newCategoryIcon: null,
    price: '',
    compareAt: '',
    cost: '',
    description: '',
    stockTracked: false,
    stock: '',
    promoOn: false,
    promoValue: '',
    promoEnds: '',
    ...overrides,
  };
}

describe('wizard step gates', () => {
  it('needs a name first', () => {
    expect(validateWizardStep(0, state())).toBe('Give the product a name');
    expect(validateWizardStep(0, state({ name: 'Apron' }))).toBeNull();
  });

  it('prices whole cedis with an optional higher was-price', () => {
    expect(validateWizardStep(3, state({ price: 'abc' }))).toContain('valid price');
    expect(validateWizardStep(3, state({ price: '45.50' }))).toBeNull();
    expect(validateWizardStep(3, state({ price: '45.50', compareAt: '40' }))).toContain(
      'must beat the sale price',
    );
    expect(validateWizardStep(3, state({ price: '45.50', compareAt: '60' }))).toBeNull();
  });

  it('counts integer stock only when tracked', () => {
    expect(validateWizardStep(5, state())).toBeNull();
    expect(validateWizardStep(5, state({ stockTracked: true, stock: '2.5' }))).toContain(
      'whole units',
    );
    expect(validateWizardStep(5, state({ stockTracked: true, stock: '7' }))).toBeNull();
  });

  it('bounds the launch promo percent', () => {
    expect(validateWizardStep(6, state())).toBeNull();
    expect(validateWizardStep(6, state({ promoOn: true, promoValue: '0' }))).toContain('1 and 100');
    expect(validateWizardStep(6, state({ promoOn: true, promoValue: '150' }))).toContain(
      '1 and 100',
    );
    expect(validateWizardStep(6, state({ promoOn: true, promoValue: '20' }))).toBeNull();
  });

  it('names a new shelf before continuing', () => {
    expect(validateWizardStep(2, state({ categoryId: '__new__' }))).toContain('Name the new shelf');
    expect(
      validateWizardStep(2, state({ categoryId: '__new__', newCategoryName: 'Drinks' })),
    ).toBeNull();
  });
});

describe('category icons', () => {
  it('accepts the allowlist and blanks, rejects the rest', () => {
    expect(isCategoryIcon('shirt')).toBe(true);
    expect(isCategoryIcon(null)).toBe(true);
    expect(isCategoryIcon(undefined)).toBe(true);
    expect(isCategoryIcon('spaceship')).toBe(false);
  });
});

describe('share links', () => {
  it('tags links with the channel ref', () => {
    expect(shareUrlWithRef('https://t/s', 'whatsapp')).toBe('https://t/s?ref=whatsapp');
    expect(shareUrlWithRef('https://t/s?a=1', 'copy')).toBe('https://t/s?a=1&ref=copy');
  });

  it('builds honest product and promo messages', () => {
    const product = productShareMessage({
      storeName: 'S',
      itemName: 'Widget',
      priceLabel: 'GH₵ 25.00',
      itemUrl: 'https://t/s#i',
    });
    expect(product).toContain('Widget');
    expect(product).toContain('GH₵ 25.00');
    const promo = promoShareMessage({
      storeName: 'S',
      promoName: 'Launch',
      headline: '20% off',
      storeUrl: 'https://t/s',
    });
    expect(promo).toContain('Launch');
    const shop = shopShareMessage({ storeName: 'S', storeUrl: 'https://t/s', tagline: null });
    expect(shop).toContain('https://t/s');
  });

  it('encodes the WhatsApp target exactly once', () => {
    const target = shareTargetFor('whatsapp', 'Hi S! Widget — GH₵ 25.00', 'https://t/s#i');
    expect(target).toBe(`https://wa.me/?text=${encodeURIComponent('Hi S! Widget — GH₵ 25.00')}`);
    expect(shareTargetFor('facebook', 'm', 'https://t/s')).toContain(
      `u=${encodeURIComponent('https://t/s')}`,
    );
    expect(shareTargetFor('copy', 'm', 'u')).toBeNull();
  });
});

describe('promo matching and countdowns', () => {
  const promos = [
    {
      name: 'Wide',
      kind: 'PERCENT' as const,
      startsAt: null,
      endsAt: null,
      itemIds: [] as string[],
      categoryIds: [] as string[],
    },
    {
      name: 'Shelf-only',
      kind: 'PERCENT' as const,
      startsAt: null,
      endsAt: null,
      itemIds: [] as string[],
      categoryIds: ['cat-1'],
    },
    {
      name: 'Item-only',
      kind: 'PERCENT' as const,
      startsAt: null,
      endsAt: null,
      itemIds: ['item-9'] as string[],
      categoryIds: [] as string[],
    },
    {
      name: 'Expired',
      kind: 'PERCENT' as const,
      startsAt: null,
      endsAt: '2020-01-01T00:00:00.000Z',
      itemIds: [] as string[],
      categoryIds: [] as string[],
    },
  ];

  it('matches store-wide, item and shelf promos — never expired ones', () => {
    const matched = promosForItem(promos, { id: 'item-1', categoryId: 'cat-1' });
    expect(matched.map((promo) => promo.name).sort()).toEqual(['Shelf-only', 'Wide']);
  });

  it('formats countdowns and goes null past the line', () => {
    expect(countdownParts('2026-10-08T01:02:03.000Z', Date.parse('2026-10-07T00:00:00.000Z'))).toBe(
      '1d 01:02:03',
    );
    expect(countdownParts('2020-01-01T00:00:00.000Z', Date.now())).toBeNull();
    expect(countdownParts('not-a-date', Date.now())).toBeNull();
  });
});
