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

type TargetedPromo = {
  name: string;
  kind: 'PERCENT' | 'FIXED';
  startsAt: string | null;
  endsAt: string | null;
  active?: boolean;
  itemIds: string[];
  categoryIds: string[];
};

/**
 * Promos currently live for one catalogue item: store-wide promos plus any
 * that name the item or its shelf. Timed-out and upcoming promos never match.
 */
export function promosForItem<T extends TargetedPromo>(
  promos: T[],
  item: { id: string; categoryId: string | null },
  now: Date = new Date(),
): T[] {
  return promos.filter((promo) => {
    if (promo.active === false) return false;
    if (promo.startsAt && new Date(promo.startsAt) > now) return false;
    if (promo.endsAt && new Date(promo.endsAt) < now) return false;
    if (promo.itemIds.length === 0 && promo.categoryIds.length === 0) return true;
    if (promo.itemIds.includes(item.id)) return true;
    return item.categoryId != null && promo.categoryIds.includes(item.categoryId);
  });
}

/** "2d 4h 12m 33s" until the ISO instant, or null once it passes. */
export function countdownParts(targetIso: string, nowMs: number = Date.now()): string | null {
  const diff = new Date(targetIso).getTime() - nowMs;
  if (!Number.isFinite(diff) || diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  const tail = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${tail}` : tail;
}

/**
 * "Oct 5, 2026" from an ISO datetime — for the "Ends …" label.
 *
 * `timeZone: 'UTC'` is required, not cosmetic. Promo dates are DATE-ONLY values
 * stored as UTC midnight (see `dateOnlyToDate`), so formatting in the viewer's
 * local zone would print the previous day for anyone west of UTC — a shop in
 * Accra would see "Ends Oct 4" for a promo that ends Oct 5. Pinning UTC makes
 * the rendering identical for every viewer, which is what a date-only value
 * means.
 */
export function formatPromoDate(iso: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

/**
 * HTML date-input value ("YYYY-MM-DD") → UTC midnight Date.
 * `null`/`undefined` pass through as null (no date set).
 */
export function dateOnlyToDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

type CouponPromo = {
  name: string;
  code: string | null;
  kind: 'PERCENT' | 'FIXED';
  value: number;
  minSubtotalPesewas: number | null;
  active?: boolean;
  startsAt: string | null;
  endsAt: string | null;
  itemIds: string[];
  categoryIds: string[];
};

/** One basket line, priced for coupon eligibility. */
export type CouponLine = {
  itemId: string;
  categoryId: string | null;
  pricePesewas: number;
  quantity: number;
};

export type CouponResult =
  | {
      ok: true;
      code: string;
      name: string;
      subtotalPesewas: number;
      eligibleSubtotalPesewas: number;
      discountPesewas: number;
    }
  | { ok: false; reason: 'missing_code' | 'not_found' | 'paused' | 'upcoming' | 'expired' }
  | { ok: false; reason: 'min_subtotal'; minSubtotalPesewas: number; subtotalPesewas: number }
  | { ok: false; reason: 'no_eligible_items' };

/**
 * Validate a coupon code against the shop's promotions and price the discount
 * for this basket. Pure and shared: the checkout dialog uses it for a live
 * preview, and the order route runs the same function so the server never
 * trusts a client-computed total.
 *
 * A code matching several live promos earns the best discount. Code-less
 * promotions are deliberately not applied here — they stay "quote in chat"
 * offers, because auto-stacking them would silently reprice the basket.
 */
export function couponDiscount<T extends CouponPromo>(
  promos: readonly T[],
  code: string,
  lines: readonly CouponLine[],
  now: Date = new Date(),
): CouponResult {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, reason: 'missing_code' };

  const named = promos.filter((promo) => promo.code?.trim().toUpperCase() === normalized);
  if (named.length === 0) return { ok: false, reason: 'not_found' };

  const states = named.map((promo) =>
    promotionState({ ...promo, active: promo.active !== false }, now),
  );
  const live = named.filter((_, index) => states[index] === 'live');
  if (live.length === 0) {
    if (states.every((state) => state === 'paused')) return { ok: false, reason: 'paused' };
    if (states.some((state) => state === 'upcoming')) return { ok: false, reason: 'upcoming' };
    return { ok: false, reason: 'expired' };
  }

  const subtotalPesewas = lines.reduce((sum, line) => sum + line.pricePesewas * line.quantity, 0);
  let best: { promo: T; discountPesewas: number; eligibleSubtotalPesewas: number } | null = null;
  let minFailure: { minSubtotalPesewas: number; subtotalPesewas: number } | null = null;

  for (const promo of live) {
    if (promo.minSubtotalPesewas != null && subtotalPesewas < promo.minSubtotalPesewas) {
      minFailure ??= { minSubtotalPesewas: promo.minSubtotalPesewas, subtotalPesewas };
      continue;
    }

    const eligibleSubtotalPesewas = lines
      .filter(
        (line) =>
          (promo.itemIds.length === 0 && promo.categoryIds.length === 0) ||
          promo.itemIds.includes(line.itemId) ||
          (line.categoryId != null && promo.categoryIds.includes(line.categoryId)),
      )
      .reduce((sum, line) => sum + line.pricePesewas * line.quantity, 0);

    if (eligibleSubtotalPesewas <= 0) continue;

    const raw =
      promo.kind === 'PERCENT'
        ? Math.floor((eligibleSubtotalPesewas * promo.value) / 100)
        : promo.value;
    const discountPesewas = Math.min(raw, eligibleSubtotalPesewas, subtotalPesewas);
    if (discountPesewas > 0 && (!best || discountPesewas > best.discountPesewas)) {
      best = { promo, discountPesewas, eligibleSubtotalPesewas };
    }
  }

  if (!best) {
    return minFailure
      ? { ok: false, reason: 'min_subtotal', ...minFailure }
      : { ok: false, reason: 'no_eligible_items' };
  }

  return {
    ok: true,
    code: normalized,
    name: best.promo.name,
    subtotalPesewas,
    eligibleSubtotalPesewas: best.eligibleSubtotalPesewas,
    discountPesewas: best.discountPesewas,
  };
}

/** Human wording for a failed coupon check, safe to show at checkout. */
export function couponErrorMessage(result: CouponResult): string {
  if (result.ok) return '';
  switch (result.reason) {
    case 'missing_code':
      return 'Enter a code';
    case 'not_found':
      return "That code isn't valid here";
    case 'paused':
      return 'That code is paused right now';
    case 'upcoming':
      return "That code isn't active yet";
    case 'expired':
      return 'That code has ended';
    case 'min_subtotal':
      return `Spend ${formatGhs(result.minSubtotalPesewas - result.subtotalPesewas)} more to use this code`;
    case 'no_eligible_items':
      return "That code doesn't apply to anything in your basket";
  }
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
