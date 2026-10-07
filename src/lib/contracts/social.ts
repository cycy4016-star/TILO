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
  // True when the schedule wrote this row rather than the owner pressing Share.
  // (Artwork and shelf come from the store payload the manager already holds —
  // no need to re-ship item data, and never the image bytes themselves.)
  auto: z.boolean(),
  platform: SocialPlatform,
  status: SocialPostStatus,
  caption: z.string(),
  externalUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SocialPostList = z.object({ items: z.array(SocialPostRecord) });

// A connected social network — one of the icons the owner taps to post.
export const SocialAccountRecord = z.object({
  id: z.string(),
  platform: SocialPlatform,
  // Handle or page name on that network ("@ama.kente").
  handle: z.string(),
  url: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// POST/PUT body: the whole connected set, saved in one go (max one row per
// platform, hence the duplicate check).
export const SocialAccountSave = z.object({
  platform: SocialPlatform,
  handle: z.string().trim().min(1, 'Add the handle for this account').max(80, 'Handle is too long'),
  url: z
    .string()
    .trim()
    .url('Enter a valid link, or leave it blank')
    .max(300, 'Link is too long')
    .nullable()
    .optional(),
});

export const SocialAccountBatch = z
  .object({ accounts: z.array(SocialAccountSave).max(4) })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const [index, account] of value.accounts.entries()) {
      if (seen.has(account.platform)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['accounts', index, 'platform'],
          message: 'That account is already in the list',
        });
      }
      seen.add(account.platform);
    }
  });

export const SocialAccountList = z.object({ items: z.array(SocialAccountRecord) });

// Cadence as the dashboard renders it: `days` null means the automation is off.
export const AutoPostSettings = z.object({
  days: z.number().int().min(1).nullable(),
  lastAt: z.string().datetime().nullable(),
  nextAt: z.string().datetime().nullable(),
});

// POST /api/store/posts/auto. `force` skips the cadence check ("generate now").
export const AutoPostGenerate = z.object({ force: z.boolean().optional() });

export const AutoPostGenerateResult = z.object({
  ok: z.literal(true),
  // 0 = not due yet (or nothing to post); >0 = a fresh batch of drafts.
  generated: z.number().int().nonnegative(),
  at: z.string().datetime(),
});

export type SocialPlatformValue = z.infer<typeof SocialPlatform>;
export type SocialPostStatusValue = z.infer<typeof SocialPostStatus>;
export type SocialPostCreateInput = z.infer<typeof SocialPostCreate>;
export type SocialPostUpdateInput = z.infer<typeof SocialPostUpdate>;
export type SocialPostRecord = z.infer<typeof SocialPostRecord>;
export type SocialPostList = z.infer<typeof SocialPostList>;
export type SocialAccountRecord = z.infer<typeof SocialAccountRecord>;
export type SocialAccountSaveInput = z.infer<typeof SocialAccountSave>;
export type SocialAccountBatchInput = z.infer<typeof SocialAccountBatch>;
export type SocialAccountList = z.infer<typeof SocialAccountList>;
export type AutoPostSettings = z.infer<typeof AutoPostSettings>;
export type AutoPostGenerateResult = z.infer<typeof AutoPostGenerateResult>;
