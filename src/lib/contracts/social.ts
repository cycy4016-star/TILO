// Client-safe social publishing contracts shared by routes and islands.
import { z } from 'zod';

export const SocialPlatform = z.enum(['TIKTOK', 'INSTAGRAM', 'FACEBOOK_PAGE', 'WHATSAPP_STATUS']);

export const SocialPostStatus = z.enum(['SHARED', 'PUBLISHED']);

// POST /api/store/posts — the owner pressed "Share to {platform}" for an item.
// `caption` is what travels along (and what the UI copies into the composer).
export const SocialPostCreate = z.object({
  itemId: z.string().trim().min(1, 'Item is required'),
  platform: SocialPlatform,
  caption: z
    .string()
    .trim()
    .min(1, 'Caption is required')
    .max(2200, 'Caption is too long — keep it under 2200 characters'),
});

// PATCH /api/store/posts/[postId] — mark the push done. PUBLISHED requires the
// finished post's URL (cleared when the link is omitted).
export const SocialPostUpdate = z.object({
  status: SocialPostStatus,
  externalUrl: z
    .string()
    .trim()
    .url('Enter a valid post link')
    .max(1000, 'Link is too long')
    .nullable()
    .optional(),
});

export const SocialPostRecord = z.object({
  id: z.string(),
  storeId: z.string(),
  itemId: z.string(),
  itemName: z.string(),
  platform: SocialPlatform,
  status: SocialPostStatus,
  caption: z.string(),
  externalUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SocialPostList = z.object({ items: z.array(SocialPostRecord) });

export type SocialPlatformValue = z.infer<typeof SocialPlatform>;
export type SocialPostStatusValue = z.infer<typeof SocialPostStatus>;
export type SocialPostCreateInput = z.infer<typeof SocialPostCreate>;
export type SocialPostUpdateInput = z.infer<typeof SocialPostUpdate>;
export type SocialPostRecord = z.infer<typeof SocialPostRecord>;
export type SocialPostList = z.infer<typeof SocialPostList>;
