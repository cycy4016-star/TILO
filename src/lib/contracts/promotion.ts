// Client-safe promotion contracts shared by the manager routes, the dashboard
// islands and the public storefront.
import { z } from 'zod';

export const PromotionKind = z.enum(['PERCENT', 'FIXED']);

// HTML date inputs send "YYYY-MM-DD". Empty means "no date" (null).
const dateOnly = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .nullable()
    .optional(),
);

// Optional promo code; blank turns into `undefined` (store-wide discount).
const optionalCode = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().toUpperCase().max(40, 'Code is too long').optional(),
);

const maxSubtotal = 100_000_000;

export const PromotionCreate = z
  .object({
    name: z.string().trim().min(1, 'Give the promo a name').max(80, 'Name is too long'),
    code: optionalCode,
    kind: PromotionKind.default('PERCENT'),
    // PERCENT: 1-100. FIXED: cedis off stored in pesewas.
    value: z.number().int().min(1, 'Discount must be at least 1').max(maxSubtotal),
    minSubtotalPesewas: z
      .number()
      .int()
      .nonnegative('Min order cannot be negative')
      .max(maxSubtotal)
      .nullable()
      .optional(),
    active: z.boolean().default(true),
    startsAt: dateOnly,
    endsAt: dateOnly,
    // Targeting: item/category ids the promo applies to. Empty = store-wide.
    itemIds: z.array(z.string().trim().min(1)).max(200).default([]),
    categoryIds: z.array(z.string().trim().min(1)).max(100).default([]),
  })
  .refine((promo) => promo.kind !== 'PERCENT' || promo.value <= 100, {
    message: 'Percentages must be between 1 and 100',
    path: ['value'],
  })
  .refine((promo) => !promo.startsAt || !promo.endsAt || promo.startsAt <= promo.endsAt, {
    message: 'End date must be on or after the start date',
    path: ['endsAt'],
  });

// PATCH body: any subset of mutable promo fields. Built by hand (NOT
// .partial()) so absent keys stay `undefined` — .partial() keeps `.default()`s,
// which would silently flip kind/active back on a one-field edit.
export const PromotionUpdate = z
  .object({
    name: z.string().trim().min(1, 'Give the promo a name').max(80, 'Name is too long').optional(),
    code: optionalCode.optional(),
    kind: PromotionKind.optional(),
    value: z.number().int().min(1, 'Discount must be at least 1').max(maxSubtotal).optional(),
    minSubtotalPesewas: z
      .number()
      .int()
      .nonnegative('Min order cannot be negative')
      .max(maxSubtotal)
      .nullable()
      .optional(),
    active: z.boolean().optional(),
    startsAt: dateOnly.optional(),
    endsAt: dateOnly.optional(),
    itemIds: z.array(z.string().trim().min(1)).max(200).optional(),
    categoryIds: z.array(z.string().trim().min(1)).max(100).optional(),
  })
  .refine((promo) => promo.kind !== 'PERCENT' || promo.value === undefined || promo.value <= 100, {
    message: 'Percentages must be between 1 and 100',
    path: ['value'],
  })
  .refine((promo) => !promo.startsAt || !promo.endsAt || promo.startsAt <= promo.endsAt, {
    message: 'End date must be on or after the start date',
    path: ['endsAt'],
  });

export const PromotionRecord = z.object({
  id: z.string(),
  storeId: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  kind: PromotionKind,
  value: z.number().int(),
  minSubtotalPesewas: z.number().int().nullable(),
  active: z.boolean(),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  // Target ids (empty = store-wide). The manager resolves these to names for
  // display; the storefront matches them against each item.
  itemIds: z.array(z.string()),
  categoryIds: z.array(z.string()),
  // true when a banner image is uploaded (bytes live in the DB, served by
  // /api/public/store/promotions/[promoId]/image).
  hasImage: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PromotionList = z.object({ items: z.array(PromotionRecord) });

// Minimal public face of a promotion for the storefront: no ids or flags,
// but the target lists so each item can match its own promos.
export const PromotionSummary = z.object({
  name: z.string(),
  code: z.string().nullable(),
  kind: PromotionKind,
  value: z.number().int(),
  minSubtotalPesewas: z.number().int().nullable(),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  itemIds: z.array(z.string()),
  categoryIds: z.array(z.string()),
  imageUrl: z.string().nullable(),
});

export type PromotionCreateInput = z.infer<typeof PromotionCreate>;
export type PromotionUpdateInput = z.infer<typeof PromotionUpdate>;
export type PromotionRecord = z.infer<typeof PromotionRecord>;
export type PromotionSummary = z.infer<typeof PromotionSummary>;
