// Client-safe social contracts shared by routes and islands.
//
// Socials are contact info, collected at onboarding: the networks the shop is
// on, each with the owner's handle. There is no publishing queue — customers
// reach the shop through its link, WhatsApp and SMS.
import { z } from 'zod';

export const SocialPlatform = z.enum(['TIKTOK', 'INSTAGRAM', 'FACEBOOK_PAGE', 'WHATSAPP_STATUS']);

// A social network the shop is on — handle or page name ("@ama.kente") plus
// an optional profile link.
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

export type SocialPlatformValue = z.infer<typeof SocialPlatform>;
export type SocialAccountRecord = z.infer<typeof SocialAccountRecord>;
export type SocialAccountSaveInput = z.infer<typeof SocialAccountSave>;
export type SocialAccountBatchInput = z.infer<typeof SocialAccountBatch>;
export type SocialAccountList = z.infer<typeof SocialAccountList>;
