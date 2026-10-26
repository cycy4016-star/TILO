// Client-safe storefront contracts shared by routes and islands.
import { z } from 'zod';
import { CategoryRecord, CategorySummary } from '@/lib/contracts/category';
import { PromotionSummary } from '@/lib/contracts/promotion';

export const StoreItemKind = z.enum(['PRODUCT', 'SERVICE']);

// Colour theme presets (see src/lib/theme.ts for swatches/seed values).
// SERVER-FACING keys only — this enum lives in the shared contract so both
// the API and the client validate against the exact same allowlist. The
// runtime value is also checked by ThemeKey.parse before it drives CSS.
export const ThemeKey = z.enum([
  'blue',
  'orange',
  'gold',
  'ember',
  'emerald',
  'ocean',
  'violet',
  'rose',
  'slate',
]);
export type ThemeKeyValue = z.infer<typeof ThemeKey>;

// Layout/appearance presets (see src/lib/theme.ts for the descriptions).
// SERVER-FACING keys only, validated like ThemeKey. "vibrant" is the loud
// yellow-black Tilza look; "professional" is the clean, straight-edged business
// layout. Stored as a plain string so unknown values degrade to the default.
export const AppearanceKey = z.enum(['vibrant', 'professional']);
export type AppearanceKeyValue = z.infer<typeof AppearanceKey>;

const optionalText = (max: number) => z.string().trim().max(max).optional();

// Link-word rules, shared by the upsert contract, the slug-check route and the
// onboarding wizard (src/lib/slug.ts) so client hints and server validation
// can never drift.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 40;

export const StoreUpsert = z
  .object({
    name: z.string().trim().min(1, 'Store name is required').max(80, 'Name is too long'),
    slug: z
      .string()
      .trim()
      .min(2, 'Link must be at least 2 characters')
      .max(SLUG_MAX, 'Link is too long')
      .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and dashes only'),
    tagline: optionalText(140),
    description: optionalText(500),
    promoBanner: optionalText(200),
    contactPhone: optionalText(40),
    // Physical pickup address shown to shoppers who choose DIRECT_PICKUP.
    address: z.string().trim().max(200, 'Address is too long').nullable().optional(),
    // Spatial origin for local-delivery pricing, captured via pin drop. Both
    // coordinates move together; null clears the pin.
    lat: z.number().finite().min(-90).max(90).nullable().optional(),
    lng: z.number().finite().min(-180).max(180).nullable().optional(),
    active: z.boolean().default(true),
    // Optional on create/update - absent means "leave as is" (DB defaults to
    // blue + professional). Keeping these required-free lets old clients PUT
    // without the fields without silently resetting the workspace look.
    theme: ThemeKey.optional(),
    appearance: AppearanceKey.optional(),
    autoDispatch: z.boolean().optional(),
    dispatchRadiusKm: z.number().finite().min(1).max(50).optional(),
  })
  .superRefine((value, ctx) => {
    const hasLat = value.lat !== undefined;
    const hasLng = value.lng !== undefined;
    if (hasLat !== hasLng) {
      const message = 'Set both the latitude and longitude (or clear both).';
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lat'], message });
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lng'], message });
      return;
    }
    if (hasLat && hasLng && (value.lat === null) !== (value.lng === null)) {
      const message = 'Set both the latitude and longitude (or clear both).';
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lat'], message });
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lng'], message });
    }
  });

// Answer to "is this link word free?": the wizard asks as the owner types so
// a taken slug is caught before Save. `suggestion` is a free alternative
// (e.g. "amas-boutique-2") or null when nothing reasonable was found.
export const SlugCheck = z.object({
  slug: z.string(),
  available: z.boolean(),
  suggestion: z.string().nullable(),
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
  // Shelf heading this product sits under. Null/absent = uncategorised, which
  // the storefront groups under its own bucket rather than hiding.
  categoryId: z.string().trim().min(1).nullable().optional(),
  pricePesewas: priceRule,
  // What it costs the workspace to source/deliver this item (pesewas).
  // Optional; powers the owner's gross-profit analytics when filled in.
  costPricePesewas: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
  // "Was" price in pesewas. Shows a strikethrough + % badge when higher than
  // the actual price. Null = not on sale.
  compareAtPricePesewas: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
  // Stock on hand. Null/absent = untracked (always orderable).
  stock: z.number().int().min(0).nullable().optional(),
});

// PATCH body: any subset of mutable item fields. Built by hand (NOT
// StoreItemCreate.partial()) so absent keys stay `undefined` — `.partial()`
// keeps `.default()`s, which would silently re-activate hidden items and reset
// their sort order on a one-field edit.
export const StoreItemUpdate = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long').optional(),
  kind: StoreItemKind.optional(),
  description: optionalText(500),
  // undefined = leave the category alone, null = remove it from every shelf.
  categoryId: z.string().trim().min(1).nullable().optional(),
  pricePesewas: priceRule.optional(),
  costPricePesewas: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
  compareAtPricePesewas: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
  stock: z.number().int().min(0).nullable().optional(),
});

export const StoreItemRecord = z.object({
  id: z.string(),
  storeId: z.string(),
  kind: StoreItemKind,
  name: z.string(),
  description: z.string().nullable(),
  // Null for uncategorised items and for any item whose category was deleted
  // (the FK is SetNull — removing a shelf never removes its products).
  categoryId: z.string().nullable(),
  pricePesewas: z.number().int().nonnegative(),
  costPricePesewas: z.number().int().nonnegative().nullable(),
  compareAtPricePesewas: z.number().int().nonnegative().nullable(),
  sortOrder: z.number().int().nonnegative(),
  active: z.boolean(),
  // Stock on hand (null = untracked). The storefront hides the order button at 0.
  stock: z.number().int().nonnegative().nullable(),
  // true when at least one uploaded photo exists (bytes live in the DB).
  hasImage: z.boolean(),
  // Gallery photo ids in display order; the first one is the cover. The
  // dashboard turns each id into /api/public/store/items/[itemId]/images/[id].
  imageIds: z.array(z.string()),
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
  // Physical pickup address + shop pin used for delivery pricing.
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  active: z.boolean(),
  theme: ThemeKey,
  appearance: AppearanceKey,
  autoDispatch: z.boolean(),
  dispatchRadiusKm: z.number(),
  // true when a logo is uploaded (bytes live in the DB, served by
  // /api/public/store/[slug]/logo).
  hasLogo: z.boolean(),
  // true when a storefront banner is uploaded (bytes live in the DB, served
  // by /api/public/store/[slug]/banner).
  hasBanner: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Ordered shelf headings. Empty for a store that never created one, which
  // the manager renders as a "no categories yet" prompt.
  categories: z.array(CategoryRecord),
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
  // Pickup details are public: shoppers need them for DIRECT_PICKUP and the
  // distance-pricing preview needs the shop's pin.
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  logoUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  theme: ThemeKey,
  appearance: AppearanceKey,
  categories: z.array(CategorySummary),
  items: z.array(
    z.object({
      id: z.string(),
      kind: StoreItemKind,
      name: z.string(),
      description: z.string().nullable(),
      // Null = uncategorised; the storefront buckets those under "More".
      categoryId: z.string().nullable(),
      pricePesewas: z.number().int().nonnegative(),
      compareAtPricePesewas: z.number().int().nonnegative().nullable(),
      stock: z.number().int().nonnegative().nullable(),
      imageUrl: z.string().nullable(),
      // Every gallery photo, cover first. `imageUrl` stays as the first entry
      // so older clients keep working.
      images: z.array(z.string()),
      // Listing time, so the storefront can offer "Newest first" without a
      // second round trip. Not sensitive: it is the shop's own publish date.
      createdAt: z.string().datetime(),
    }),
  ),
  promotions: z.array(PromotionSummary),
});

export type StoreUpsertInput = z.infer<typeof StoreUpsert>;
export type SlugCheckResult = z.infer<typeof SlugCheck>;
export type StoreItemCreateInput = z.infer<typeof StoreItemCreate>;
export type StoreItemUpdateInput = z.infer<typeof StoreItemUpdate>;
export type StoreItem = z.infer<typeof StoreItemRecord>;
export type StoreItemList = z.infer<typeof StoreItemList>;
export type StorePayload = z.infer<typeof StorePayload>;
export type StorePublic = z.infer<typeof StorePublic>;
