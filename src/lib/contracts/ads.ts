// Client-safe ad contracts shared by the /api/ads route and the Ad Studio
// island. The daily ad feed is DERIVED from the live catalogue — nothing is
// persisted, so no schema/migration is involved.
import { z } from 'zod';
import { StoreItemKind } from '@/lib/contracts/store';

// The three shapes the ad image route can render. `wide` doubles as the
// link-preview card, so it matches the existing product share image.
export const AdFormatKey = z.enum(['square', 'story', 'wide']);

// One ready-to-post ad built from a single listing: the copy the owner pastes
// and the listing facts the UI shows beside the generated artwork.
export const AdDraft = z.object({
  itemId: z.string(),
  kind: StoreItemKind,
  itemName: z.string(),
  categoryName: z.string().nullable(),
  pricePesewas: z.number().int().nonnegative(),
  compareAtPricePesewas: z.number().int().nonnegative().nullable(),
  // Auto markdown % (compare-at vs price), or null when there is no sale.
  discountPercent: z.number().int().nonnegative().nullable(),
  hasImage: z.boolean(),
  stock: z.number().int().nonnegative().nullable(),
  // Short label for the angle the day picked ("New arrival", "Deal", …).
  angle: z.string(),
  headline: z.string(),
  // The full caption the owner posts: headline, body, link, hashtags.
  caption: z.string(),
  hashtags: z.array(z.string()),
});

// Today's ad feed for one shop. `dayKey` (YYYY-MM-DD, UTC) is the rotation seed
// — the same listings produce a fresh set at the next UTC day boundary.
export const AdFeed = z.object({
  generatedAt: z.string().datetime(),
  dayKey: z.string(),
  storeName: z.string(),
  storeSlug: z.string(),
  storeTagline: z.string().nullable(),
  // The shop's WhatsApp number, so the Ad Studio can make the ad's
  // "Order on WhatsApp" call to action live in the preview. Null = no chat.
  contactPhone: z.string().nullable(),
  ads: z.array(AdDraft),
});

export type AdFormatKeyValue = z.infer<typeof AdFormatKey>;
export type AdDraft = z.infer<typeof AdDraft>;
export type AdFeed = z.infer<typeof AdFeed>;
