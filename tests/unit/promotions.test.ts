// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  PromotionCreate,
  PromotionRecord,
  PromotionSummary,
  PromotionUpdate,
} from '@/lib/contracts/promotion';
import {
  dateOnlyToDate,
  formatPromoDate,
  isPromoLive,
  itemDiscountPercent,
  promoHeadline,
  promoTerms,
  promotionState,
} from '@/lib/promotions';

const promo = (overrides: Record<string, unknown> = {}) => ({
  name: 'Mid-sem sale',
  code: 'student10',
  kind: 'PERCENT',
  value: 10,
  minSubtotalPesewas: 5000,
  active: true,
  startsAt: '2026-09-20',
  endsAt: '2026-10-05',
  ...overrides,
});

describe('PromotionCreate', () => {
  it('accepts a live percent promo with dates', () => {
    expect(PromotionCreate.safeParse(promo()).success).toBe(true);
  });

  it('accepts a store-wide FIXED promo without a code or dates', () => {
    expect(
      PromotionCreate.safeParse(
        promo({ kind: 'FIXED', value: 5000, code: '', startsAt: '', endsAt: '' }),
      ).success,
    ).toBe(true);
  });

  it('rejects percent values over 100', () => {
    const result = PromotionCreate.safeParse(promo({ value: 150 }));
    expect(result.success).toBe(false);
  });

  it('rejects a code that outlives its own length', () => {
    expect(PromotionCreate.safeParse(promo({ code: 'a'.repeat(41) })).success).toBe(false);
  });

  it('rejects an end date before the start date', () => {
    expect(
      PromotionCreate.safeParse(promo({ startsAt: '2026-10-05', endsAt: '2026-09-20' })).success,
    ).toBe(false);
  });

  it('keeps a blank code and blank dates as null-ish', () => {
    const result = PromotionCreate.safeParse(
      promo({ code: '  ', startsAt: '', endsAt: '', minSubtotalPesewas: null }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBeUndefined();
      expect(result.data.startsAt).toBeNull();
      expect(result.data.minSubtotalPesewas).toBeNull();
    }
  });
});

describe('PromotionUpdate', () => {
  it('accepts a one-field patch without flipping defaults', () => {
    expect(PromotionUpdate.safeParse({ value: 15 }).success).toBe(true);
    expect(PromotionUpdate.safeParse({}).success).toBe(true);
  });

  it('rejects a percent patch over 100', () => {
    expect(PromotionUpdate.safeParse({ kind: 'PERCENT', value: 101 }).success).toBe(false);
  });

  it('accepts clearing the code', () => {
    const result = PromotionUpdate.safeParse({ code: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.code).toBeUndefined();
  });
});

describe('promotion serialization contracts', () => {
  const record = {
    id: 'p-1',
    storeId: 's-1',
    name: 'Mid-sem sale',
    code: 'STUDENT10',
    kind: 'PERCENT',
    value: 10,
    minSubtotalPesewas: 5000,
    active: true,
    startsAt: '2026-09-20T00:00:00.000Z',
    endsAt: '2026-10-05T00:00:00.000Z',
    hasImage: false,
    createdAt: '2026-09-22T00:00:00.000Z',
    updatedAt: '2026-09-22T00:00:00.000Z',
  };

  it('parses the manager record', () => {
    expect(PromotionRecord.safeParse(record).success).toBe(true);
  });

  it('parses the public summary with an image URL', () => {
    const result = PromotionSummary.safeParse({
      name: record.name,
      code: record.code,
      kind: record.kind,
      value: record.value,
      minSubtotalPesewas: record.minSubtotalPesewas,
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      imageUrl: null,
    });
    expect(result.success).toBe(true);
  });

  it('hides internal fields from the summary', () => {
    expect(Object.keys(PromotionSummary.shape)).not.toContain('storeId');
    expect(Object.keys(PromotionSummary.shape)).not.toContain('active');
  });
});

describe('promo display helpers', () => {
  it('headlines a percent and a fixed discount', () => {
    expect(promoHeadline({ kind: 'PERCENT', value: 10 })).toBe('10% off');
    expect(promoHeadline({ kind: 'FIXED', value: 5000 })).toBe('GH₵ 50.00 off');
  });

  it('lists the terms a customer needs to know', () => {
    expect(promoTerms({ code: 'X', minSubtotalPesewas: 5000 })).toEqual(['Min. order GH₵ 50.00']);
    expect(promoTerms({ code: 'X', minSubtotalPesewas: null })).toEqual([]);
  });

  it('sorts a promo against the clock', () => {
    const now = new Date('2026-09-22T12:00:00.000Z');
    const base = { ...promo(), endsAt: '2026-10-05T00:00:00.000Z' } as unknown as Record<
      string,
      unknown
    >;
    expect(promotionState({ ...base, startsAt: '2026-09-20T00:00:00.000Z' } as never, now)).toBe(
      'live',
    );
    expect(promotionState({ ...base, startsAt: '2026-09-25T00:00:00.000Z' } as never, now)).toBe(
      'upcoming',
    );
    expect(promotionState({ ...base, startsAt: '2026-08-01T00:00:00.000Z' } as never, now)).toBe(
      'live',
    );
    expect(
      promotionState(
        {
          ...base,
          startsAt: '2026-08-01T00:00:00.000Z',
          endsAt: '2026-09-01T00:00:00.000Z',
        } as never,
        now,
      ),
    ).toBe('ended');
    expect(promotionState({ ...base, active: false } as never, now)).toBe('paused');
  });

  it('knows when a promo is on the storefront right now', () => {
    expect(
      isPromoLive(
        {
          kind: 'PERCENT',
          value: 10,
          minSubtotalPesewas: null,
          active: true,
          startsAt: '2026-09-20T00:00:00.000Z',
          endsAt: '2026-10-05T00:00:00.000Z',
        },
        new Date('2026-09-22T12:00:00.000Z'),
      ),
    ).toBe(true);
    expect(
      isPromoLive({
        kind: 'PERCENT',
        value: 10,
        minSubtotalPesewas: null,
        active: false,
        startsAt: null,
        endsAt: null,
      }),
    ).toBe(false);
  });

  it('formats an ISO datetime as a friendly date', () => {
    expect(formatPromoDate('2026-10-05T00:00:00.000Z')).toBe('Oct 5, 2026');
  });

  it('turns a YYYY-MM-DD input into UTC midnight', () => {
    expect(dateOnlyToDate('2026-10-05')).toEqual(new Date('2026-10-05T00:00:00.000Z'));
    expect(dateOnlyToDate(null)).toBeNull();
  });

  it('computes the visible sale percentage', () => {
    expect(itemDiscountPercent({ pricePesewas: 4500, compareAtPricePesewas: 6000 })).toBe(25);
    expect(itemDiscountPercent({ pricePesewas: 4500, compareAtPricePesewas: null })).toBeNull();
    expect(itemDiscountPercent({ pricePesewas: 6000, compareAtPricePesewas: 6000 })).toBeNull();
    expect(itemDiscountPercent({ pricePesewas: 6000, compareAtPricePesewas: 4500 })).toBeNull();
  });
});
