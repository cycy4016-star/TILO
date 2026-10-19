// Storefront catalogue view rules: search, filters, sort, pagination.
//
// These run without React, so the shelf behaviour is pinned here rather than
// inferred from rendered markup: a price sort stays inside a shelf, "in stock"
// treats untracked items as available, and a saved-only view is driven by the
// device's heart set.
import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  formatGhsInput,
  limitGroups,
  matchesFilters,
  matchesQuery,
  parseGhsInput,
  priceBounds,
  sortItems,
  type ViewItem,
} from '@/lib/catalog-view';

function item(overrides: Partial<ViewItem> = {}): ViewItem {
  return {
    id: 'item-1',
    name: 'Apron',
    description: null,
    pricePesewas: 1000,
    compareAtPricePesewas: null,
    stock: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('matchesQuery', () => {
  it('matches name, description and shelf, case-insensitively', () => {
    const apron = item({ name: 'Branded Apron', description: 'Heavy cotton' });
    expect(matchesQuery(apron, 'apron', null)).toBe(true);
    expect(matchesQuery(apron, 'cotton', null)).toBe(true);
    expect(matchesQuery(apron, 'aprons', 'Aprons')).toBe(true);
    expect(matchesQuery(apron, 'shoes', 'Aprons')).toBe(false);
  });

  it('lets an empty needle through', () => {
    expect(matchesQuery(item(), '', null)).toBe(true);
  });
});

describe('matchesFilters', () => {
  const saved = new Set(['saved-1']);

  it('treats untracked stock as in stock and zero as out', () => {
    const filters = { ...DEFAULT_FILTERS, inStockOnly: true };
    expect(matchesFilters(item({ stock: null }), filters, saved)).toBe(true);
    expect(matchesFilters(item({ stock: 3 }), filters, saved)).toBe(true);
    expect(matchesFilters(item({ stock: 0 }), filters, saved)).toBe(false);
  });

  it('requires a real markdown for on-sale-only', () => {
    const filters = { ...DEFAULT_FILTERS, onSaleOnly: true };
    expect(matchesFilters(item({ compareAtPricePesewas: null }), filters, saved)).toBe(false);
    expect(
      matchesFilters(item({ pricePesewas: 800, compareAtPricePesewas: 1000 }), filters, saved),
    ).toBe(true);
  });

  it('honours the saved set', () => {
    const filters = { ...DEFAULT_FILTERS, savedOnly: true };
    expect(matchesFilters(item({ id: 'saved-1' }), filters, saved)).toBe(true);
    expect(matchesFilters(item({ id: 'other' }), filters, saved)).toBe(false);
  });

  it('applies an inclusive price band', () => {
    const filters = { ...DEFAULT_FILTERS, minPesewas: 500, maxPesewas: 1500 };
    expect(matchesFilters(item({ pricePesewas: 500 }), filters, saved)).toBe(true);
    expect(matchesFilters(item({ pricePesewas: 1500 }), filters, saved)).toBe(true);
    expect(matchesFilters(item({ pricePesewas: 499 }), filters, saved)).toBe(false);
    expect(matchesFilters(item({ pricePesewas: 1501 }), filters, saved)).toBe(false);
  });
});

describe('sortItems', () => {
  const cheap = item({ id: 'a', name: 'Cheap', pricePesewas: 500 });
  const dear = item({ id: 'b', name: 'Dear', pricePesewas: 5000 });
  const sale = item({
    id: 'c',
    name: 'Sale',
    pricePesewas: 800,
    compareAtPricePesewas: 1000,
  });
  const old = item({
    id: 'd',
    name: 'Old',
    pricePesewas: 900,
    createdAt: '2025-01-01T00:00:00.000Z',
  });

  it('preserves the owner order for featured', () => {
    expect(sortItems([dear, cheap, sale], 'featured').map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('sorts by price both ways', () => {
    expect(sortItems([dear, cheap, sale], 'price-asc').map((i) => i.id)).toEqual(['a', 'c', 'b']);
    expect(sortItems([dear, cheap, sale], 'price-desc').map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('puts the biggest markdown first and non-sale items last', () => {
    expect(sortItems([dear, cheap, sale], 'discount').map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('puts the newest first', () => {
    expect(sortItems([old, cheap, dear], 'newest').map((i) => i.id)).toEqual(['a', 'b', 'd']);
  });
});

describe('activeFilterCount', () => {
  it('counts each facet once and the price band once', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(
      activeFilterCount({
        ...DEFAULT_FILTERS,
        inStockOnly: true,
        onSaleOnly: true,
        savedOnly: true,
        minPesewas: 100,
        maxPesewas: 200,
      }),
    ).toBe(4);
  });
});

describe('limitGroups', () => {
  it('caps items across shelves and drops empty shelves', () => {
    const groups = [
      { label: 'A', items: [1, 2, 3] },
      { label: 'B', items: [4, 5] },
      { label: 'C', items: [6] },
    ];
    expect(limitGroups(groups, 4)).toEqual([
      { label: 'A', items: [1, 2, 3] },
      { label: 'B', items: [4] },
    ]);
    expect(limitGroups(groups, 0)).toEqual([]);
  });
});

describe('price input helpers', () => {
  it('parses GH₵ text to pesewas', () => {
    expect(parseGhsInput('12.50')).toBe(1250);
    expect(parseGhsInput('GH₵ 5')).toBe(500);
    expect(parseGhsInput('')).toBeNull();
    expect(parseGhsInput('-2')).toBeNull();
  });

  it('formats pesewas without trailing zeros', () => {
    expect(formatGhsInput(1250)).toBe('12.5');
    expect(formatGhsInput(500)).toBe('5');
    expect(formatGhsInput(null)).toBe('');
  });
});

describe('priceBounds', () => {
  it('reports the catalogue range and null when empty', () => {
    expect(priceBounds([])).toBeNull();
    expect(
      priceBounds([{ pricePesewas: 700 }, { pricePesewas: 200 }, { pricePesewas: 900 }]),
    ).toEqual({
      min: 200,
      max: 900,
    });
  });
});
