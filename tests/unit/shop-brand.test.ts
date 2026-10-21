import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHOP_LOOK,
  getShopLook,
  SHOP_LOOKS,
  shopInitials,
  shopPath,
  suggestShopNames,
} from '@/lib/shop-brand';

describe('shop brand helpers', () => {
  it('offers tap-friendly name ideas from the first name', () => {
    const names = suggestShopNames('Ama Mensah');
    expect(names).toHaveLength(4);
    expect(names[0]).toBe("Ama's Shop");
    expect(names[2]).toBe('Ama Studio');
  });

  it('keeps generic ideas when there is no first name', () => {
    expect(suggestShopNames('')).toEqual([
      'The Corner Shop',
      'Market Finds',
      'Little Studio',
      'Everyday Goods',
    ]);
  });

  it('turns shop names into safe monograms', () => {
    expect(shopInitials('Ama Boutique')).toBe('AB');
    expect(shopInitials('Solo')).toBe('S');
    expect(shopInitials('   ')).toBe('T');
    expect(shopInitials("Ama's")).toBe('A');
  });

  it('falls back to the default look for unknown values', () => {
    expect(getShopLook('not-a-look').key).toBe(DEFAULT_SHOP_LOOK);
    expect(getShopLook(null).key).toBe(DEFAULT_SHOP_LOOK);
    expect(SHOP_LOOKS.map((look) => look.key)).toEqual(['sunrise', 'market', 'fresh', 'midnight']);
  });

  it('builds a stable storefront path', () => {
    expect(shopPath('ama-boutique')).toBe('/store/ama-boutique');
    expect(shopPath('')).toBe('/store/your-shop');
  });
});
