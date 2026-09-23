// Client-safe storefront contracts shared by routes and islands.
import { z } from 'zod';
import { PromotionSummary } from '@/lib/contracts/promotion';

export const StoreItemKind = z.enum(['PRODUCT', 'SERVICE']);

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const StoreUpsert = z.object({
  name: z.string().trim().min(1, 'Store name is required').max(80, 'Name is too long'),
  slug: z
    .string()
    .trim()
    .min(2, 'Link must be at least 2 characters')
    .max(40, 'Link is too long')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes only'),
  tagline: optionalText(140),
  description: optionalText(500),
  promoBanner: optionalText(200),
  contactPhone: optionalText(40),
  active: z.boolean().default(true),
});

const priceRule = z
  .number()
  .int('Amount must be a whole number')
  .nonnegative('Amount cannot be negative')
  .max(100_000_000, 'Amount too large');

export const StoreItemCreate = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long'),
  kind: StoreItemKind.default('PRODUCT'),
  description: optionalText(500),
  pricePesewas: priceRule,
  // What it costs the workspace to source/deliver this item (pesewas).
  // Optional; powers the owner's gross-profit analytics when filled in.
  costPricePesewas: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
  // "Was" price in pesewas. Shows a strikethrough + % badge when higher than
  // the actual price. Null = not on sale.
  compareAtPricePesewas: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
});

// PATCH body: any subset of mutable item fields. Built by hand (NOT
// StoreItemCreate.partial()) so absent keys stay `undefined` — `.partial()`
// keeps `.default()`s, which would silently re-activate hidden items and reset
// their sort order on a one-field edit.
export const StoreItemUpdate = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long').optional(),
  kind: StoreItemKind.optional(),
  description: optionalText(500),
  pricePesewas: priceRule.optional(),
  costPricePesewas: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
  compareAtPricePesewas: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
});

export const StoreItemRecord = z.object({
  id: z.string(),
  storeId: z.string(),
  kind: StoreItemKind,
  name: z.string(),
  description: z.string().nullable(),
  pricePesewas: z.number().int().nonnegative(),
  costPricePesewas: z.number().int().nonnegative().nullable(),
  compareAtPricePesewas: z.number().int().nonnegative().nullable(),
  sortOrder: z.number().int().nonnegative(),
  active: z.boolean(),
  // true when an uploaded photo exists (bytes live in the DB, served by
  // /api/public/store/items/[itemId]/image).
  hasImage: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const StoreItemList = z.object({ items: z.array(StoreItemRecord) });

// Full store + all items, used by the dashboard manager. Built standalone (not
// extended from StoreUpsert) so the wire shape has no `.default()` fields —
// the client parses this as the exact API contract.
export const StorePayload = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  promoBanner: z.string().nullable(),
  contactPhone: z.string().nullable(),
  active: z.boolean(),
  // true when a logo is uploaded (bytes live in the DB, served by
  // /api/public/store/[slug]/logo).
  hasLogo: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z.array(StoreItemRecord),
});

// Minimal public face: no ids, only live items. Image URLs let the storefront
// render photos; the bytes themselves are served by the public image routes.
export const StorePublic = z.object({
  name: z.string(),
  slug: z.string(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  promoBanner: z.string().nullable(),
  contactPhone: z.string().nullable(),
  logoUrl: z.string().nullable(),
  items: z.array(
    z.object({
      id: z.string(),
      kind: StoreItemKind,
      name: z.string(),
      description: z.string().nullable(),
      pricePesewas: z.number().int().nonnegative(),
      compareAtPricePesewas: z.number().int().nonnegative().nullable(),
      imageUrl: z.string().nullable(),
    }),
  ),
  promotions: z.array(PromotionSummary),
});

export type StoreUpsertInput = z.infer<typeof StoreUpsert>;
export type StoreItemCreateInput = z.infer<typeof StoreItemCreate>;
export type StoreItemUpdateInput = z.infer<typeof StoreItemUpdate>;
export type StoreItem = z.infer<typeof StoreItemRecord>;
export type StoreItemList = z.infer<typeof StoreItemList>;
export type StorePayload = z.infer<typeof StorePayload>;
export type StorePublic = z.infer<typeof StorePublic>;
