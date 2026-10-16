import { describe, expect, it } from 'vitest';
import {
  AD_FORMATS,
  type AdCampaignItem,
  type AdItemInput,
  type AdPromoInput,
  adFormat,
  adImagePath,
  adOrderAction,
  adPostPlan,
  buildCampaignCaption,
  buildDailyAds,
  CAROUSEL_MAX,
  carouselAdPath,
  dayKey,
  hashSeed,
  storeOrderAction,
} from '@/lib/ads';

const STORE = {
  storeName: 'Ama Kente',
  storeSlug: 'ama-kente',
  storeTagline: 'Handwoven in Accra',
  storeUrl: 'https://tilza.org/store/ama-kente',
};

const ITEMS: AdItemInput[] = [
  {
    id: 'i1',
    kind: 'PRODUCT',
    name: 'Kente Scarf',
    description: 'A handwoven kente scarf from Bonwire.',
    categoryId: 'c1',
    categoryName: 'Scarves',
    pricePesewas: 12000,
    compareAtPricePesewas: 15000,
    stock: 3,
    hasImage: true,
  },
  {
    id: 'i2',
    kind: 'SERVICE',
    name: 'Logo Design',
    description: null,
    categoryId: null,
    categoryName: null,
    pricePesewas: 50000,
    compareAtPricePesewas: null,
    stock: null,
    hasImage: false,
  },
];

const PROMOTIONS: AdPromoInput[] = [
  {
    name: 'Mid-Sem Sale',
    code: 'STUDENT10',
    kind: 'PERCENT',
    value: 10,
    minSubtotalPesewas: null,
    startsAt: null,
    endsAt: null,
    active: true,
    itemIds: [],
    categoryIds: [],
  },
];

const DAY = new Date('2026-10-14T09:00:00.000Z');

describe('ad formats', () => {
  it('defaults an unknown format to square', () => {
    expect(adFormat('nonsense').key).toBe('square');
    expect(adFormat(null).key).toBe('square');
    expect(adFormat('story').key).toBe('story');
  });

  it('offers three formats with sane dimensions', () => {
    expect(AD_FORMATS.map((format) => format.key)).toEqual(['square', 'story', 'wide']);
    for (const format of AD_FORMATS) {
      expect(format.width).toBeGreaterThan(0);
      expect(format.height).toBeGreaterThan(0);
    }
  });

  it('builds the image path with the format query', () => {
    expect(adImagePath('abc', 'story')).toBe('/api/public/store/items/abc/ad?format=story');
  });
});

describe('day rotation helpers', () => {
  it('keys the day in UTC', () => {
    expect(dayKey(DAY)).toBe('2026-10-14');
  });

  it('hashes deterministically and varies by input', () => {
    expect(hashSeed(['shop', '2026-10-14', 'i1'])).toBe(hashSeed(['shop', '2026-10-14', 'i1']));
    expect(hashSeed(['shop', '2026-10-14', 'i1'])).not.toBe(hashSeed(['shop', '2026-10-15', 'i1']));
  });
});

describe('adPostPlan', () => {
  const caption = 'New at Ama Kente\n\nlink here';
  const url = 'https://tilza.org/store/ama-kente#i1';

  it('hands WhatsApp the whole caption', () => {
    const plan = adPostPlan('whatsapp', caption, url);
    expect(plan.href).toContain('https://wa.me/?text=');
    expect(plan.href).toContain(encodeURIComponent(caption));
    expect(plan.saveImage).toBe(false);
  });

  it('saves the image and copies the caption for image-first networks', () => {
    const instagram = adPostPlan('instagram', caption, url);
    expect(instagram.saveImage).toBe(true);
    expect(instagram.copyCaption).toBe(true);
    expect(instagram.href).toBeTruthy();
  });

  it('copies the caption for Facebook, which takes only a link', () => {
    const facebook = adPostPlan('facebook', caption, url);
    expect(facebook.copyCaption).toBe(true);
    expect(facebook.href).toContain('facebook.com/sharer');
    expect(facebook.saveImage).toBe(false);
  });
});

describe('buildDailyAds', () => {
  it('builds one ad per item, with the shop and day stamped on', () => {
    const feed = buildDailyAds({ ...STORE, items: ITEMS, promotions: PROMOTIONS, date: DAY });
    expect(feed.dayKey).toBe('2026-10-14');
    expect(feed.storeName).toBe('Ama Kente');
    expect(feed.ads).toHaveLength(2);
    expect(feed.ads.map((ad) => ad.itemId)).toEqual(['i1', 'i2']);
  });

  it('carries the price, discount, link and hashtags into the caption', () => {
    const feed = buildDailyAds({ ...STORE, items: ITEMS, promotions: PROMOTIONS, date: DAY });
    const scarf = feed.ads[0];
    expect(scarf).toBeDefined();
    if (!scarf) return;
    expect(scarf.discountPercent).toBe(20);
    expect(scarf.caption).toContain('120.00');
    expect(scarf.caption).toContain('150.00');
    expect(scarf.caption).toContain('#i1');
    expect(scarf.caption).toContain('Only 3 left');
    expect(scarf.caption).toContain('STUDENT10');
    expect(scarf.hashtags.length).toBeGreaterThan(0);
    for (const tag of scarf.hashtags) {
      expect(tag.startsWith('#')).toBe(true);
      expect(tag).not.toContain(' ');
    }
  });

  it('writes a service caption without a product-only line', () => {
    const feed = buildDailyAds({ ...STORE, items: ITEMS, promotions: PROMOTIONS, date: DAY });
    const service = feed.ads[1];
    expect(service).toBeDefined();
    if (!service) return;
    expect(service.discountPercent).toBeNull();
    expect(service.caption).toContain('500.00');
    expect(service.caption).not.toContain('Only 3 left');
  });

  it('is stable within a day', () => {
    const first = buildDailyAds({ ...STORE, items: ITEMS, promotions: PROMOTIONS, date: DAY });
    const second = buildDailyAds({ ...STORE, items: ITEMS, promotions: PROMOTIONS, date: DAY });
    expect(second.ads.map((ad) => ad.caption)).toEqual(first.ads.map((ad) => ad.caption));
  });

  it('rotates the angle from day to day', () => {
    const headlines = new Set<string>();
    for (let day = 1; day <= 28; day += 1) {
      const date = new Date(Date.UTC(2026, 9, day, 9));
      const feed = buildDailyAds({ ...STORE, items: ITEMS, promotions: PROMOTIONS, date });
      const scarf = feed.ads[0];
      if (scarf) headlines.add(scarf.headline);
    }
    expect(headlines.size).toBeGreaterThan(1);
  });
});

describe('adOrderAction', () => {
  const BASE = {
    storeName: 'Ama Kente',
    storeSlug: 'ama-kente',
    itemId: 'i1',
    itemName: 'Kente Scarf',
    pricePesewas: 12000,
    compareAtPricePesewas: 15000,
    discountPercent: 20,
    origin: 'https://tilza.org',
  };

  it('opens the shop chat with a prefilled order', () => {
    const action = adOrderAction({ ...BASE, contactPhone: '0241234567' });
    expect(action.whatsapp).toBe(true);
    expect(action.label).toBe('Order on WhatsApp');
    expect(action.href).toBe(
      `https://wa.me/233241234567?text=${encodeURIComponent(
        'Hi Ama Kente! Please add for me: Kente Scarf — GH₵ 120.00, was GH₵ 150.00 (20% off).',
      )}`,
    );
  });

  it('falls back to the shop link when there is no usable number', () => {
    const action = adOrderAction({ ...BASE, contactPhone: null });
    expect(action.whatsapp).toBe(false);
    expect(action.label).toBe('Order from our shop');
    expect(action.href).toBe('https://tilza.org/store/ama-kente#i1');
  });

  it('uses the plain price when the listing is not on sale', () => {
    const action = adOrderAction({
      ...BASE,
      discountPercent: null,
      compareAtPricePesewas: null,
      contactPhone: '+233241234567',
    });
    expect(action.href).toContain(encodeURIComponent('GH₵ 120.00.'));
    expect(action.href).not.toContain('was');
  });
});

describe('carouselAdPath', () => {
  it('joins ids in order and carries the format', () => {
    expect(carouselAdPath('ama-kente', ['i1', 'i2'], 'story')).toBe(
      '/api/public/store/ama-kente/carousel?ids=i1%2Ci2&format=story',
    );
  });

  it('caps the id list at the format maximum', () => {
    const ids = Array.from({ length: 10 }, (_, index) => `i${index}`);
    const path = carouselAdPath('shop', ids, 'wide');
    const query = new URLSearchParams(path.split('?')[1]);
    expect(query.get('ids')?.split(',')).toHaveLength(CAROUSEL_MAX.wide);
  });

  it('gives every format room for at least one listing', () => {
    for (const format of AD_FORMATS) {
      expect(CAROUSEL_MAX[format.key]).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('storeOrderAction', () => {
  it('opens the shop chat with a generic order', () => {
    const action = storeOrderAction({
      storeName: 'Ama Kente',
      storeSlug: 'ama-kente',
      contactPhone: '0241234567',
      origin: 'https://tilza.org',
    });
    expect(action.whatsapp).toBe(true);
    expect(action.label).toBe('Order on WhatsApp');
    expect(action.href).toBe(
      `https://wa.me/233241234567?text=${encodeURIComponent(
        "Hi Ama Kente! I'd like to order from your shop.",
      )}`,
    );
  });

  it('falls back to the shop link with no usable number', () => {
    const action = storeOrderAction({
      storeName: 'Ama Kente',
      storeSlug: 'ama-kente',
      contactPhone: null,
      origin: 'https://tilza.org',
    });
    expect(action.whatsapp).toBe(false);
    expect(action.label).toBe('Visit our shop');
    expect(action.href).toBe('https://tilza.org/store/ama-kente');
  });
});

describe('buildCampaignCaption', () => {
  const items: AdCampaignItem[] = [
    {
      itemId: 'i1',
      headline: 'New at Ama Kente: Kente Scarf',
      pricePesewas: 12000,
      compareAtPricePesewas: 15000,
      discountPercent: 20,
      hashtags: ['#KenteScarf', '#ShopLocal'],
    },
    {
      itemId: 'i2',
      headline: 'Book Logo Design today',
      pricePesewas: 50000,
      compareAtPricePesewas: null,
      discountPercent: null,
      hashtags: ['#LogoDesign', '#ShopLocal'],
    },
  ];

  it('numbers each listing with its price and a deep link', () => {
    const caption = buildCampaignCaption({
      storeName: 'Ama Kente',
      storeSlug: 'ama-kente',
      origin: 'https://tilza.org',
      contactPhone: null,
      items,
    });
    expect(caption).toContain("Ama Kente — today's picks");
    expect(caption).toContain('1. New at Ama Kente: Kente Scarf');
    expect(caption).toContain('GH₵ 120.00 (was GH₵ 150.00, 20% off)');
    expect(caption).toContain('2. Book Logo Design today');
    expect(caption).toContain('https://tilza.org/store/ama-kente#i1');
    expect(caption).toContain('Shop the full collection:');
  });

  it('dedupes hashtags across listings and links the shop chat', () => {
    const caption = buildCampaignCaption({
      storeName: 'Ama Kente',
      storeSlug: 'ama-kente',
      origin: 'https://tilza.org',
      contactPhone: '0241234567',
      items,
    });
    expect(caption).toContain('Order on WhatsApp:');
    expect(caption.match(/#ShopLocal/g)).toHaveLength(1);
    expect(caption).toContain('#KenteScarf');
    expect(caption).toContain('#LogoDesign');
  });

  it('honours a custom title', () => {
    const caption = buildCampaignCaption({
      storeName: 'Ama Kente',
      storeSlug: 'ama-kente',
      origin: 'https://tilza.org',
      contactPhone: null,
      title: 'Weekend bundle',
      items: [items[0] as AdCampaignItem],
    });
    expect(caption.startsWith('Weekend bundle')).toBe(true);
  });
});
