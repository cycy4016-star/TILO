// Client-safe helpers that turn promotion/price records into display strings
// and flags. Shared by the dashboard manager and the public storefront so the
// store owner sees exactly what customers see.
import { formatGhs } from '@/lib/contracts/order';

type PromoLike = {
  kind: 'PERCENT' | 'FIXED';
  value: number;
  code?: string | null;
  minSubtotalPesewas: number | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

/** "10% off" or "GH₵ 5 off" — the headline on the offers card. */
export function promoHeadline(promo: Pick<PromoLike, 'kind' | 'value'>): string {
  return promo.kind === 'PERCENT' ? `${promo.value}% off` : `${formatGhs(promo.value)} off`;
}

/** Second line: "Min. order GH₵ 50 · No code needed" style clauses. */
export function promoTerms(promo: Pick<PromoLike, 'code' | 'minSubtotalPesewas'>): string[] {
  const terms: string[] = [];
  if (promo.minSubtotalPesewas != null && promo.minSubtotalPesewas > 0) {
    terms.push(`Min. order ${formatGhs(promo.minSubtotalPesewas)}`);
  }
  return terms;
}

export type PromoState = 'live' | 'upcoming' | 'ended' | 'paused';

/** Where a promo sits against the clock, used by the manager and storefront. */
export function promotionState(promo: PromoLike, now: Date = new Date()): PromoState {
  if (!promo.active) return 'paused';
  if (promo.startsAt && new Date(promo.startsAt) > now) return 'upcoming';
  if (promo.endsAt && new Date(promo.endsAt) < now) return 'ended';
  return 'live';
}

/** True when the public storefront should be showing the promo right now. */
export function isPromoLive(promo: PromoLike, now: Date = new Date()): boolean {
  return promotionState(promo, now) === 'live';
}

/** "Oct 5, 2026" from an ISO datetime — for the "Ends …" label. */
export function formatPromoDate(iso: string): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(iso),
  );
}

/**
 * HTML date-input value ("YYYY-MM-DD") → UTC midnight Date.
 * `null`/`undefined` pass through as null (no date set).
 */
export function dateOnlyToDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

/** Auto-discount % for a sale item: null when there is no visible markdown. */
export function itemDiscountPercent(item: {
  pricePesewas: number;
  compareAtPricePesewas: number | null;
}): number | null {
  const original = item.compareAtPricePesewas;
  if (original == null || original <= item.pricePesewas || original <= 0) return null;
  return Math.round((1 - item.pricePesewas / original) * 100);
}
