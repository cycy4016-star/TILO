// Wire contract for the public feedback form at /feedback (and the storefront
// widget). Deliberately loose and unauthenticated: anyone can tell Tilo what is
// broken, which is the whole point — the operator wants to hear about a problem
// from the user, not from a stack trace.
import { z } from 'zod';

export const FeedbackKind = z.enum(['BUG', 'COMPLAINT', 'PRAISE', 'SUGGESTION', 'OTHER']);

export const FeedbackCreate = z.object({
  message: z
    .string()
    .trim()
    .min(10, 'Tell us a little more — at least 10 characters')
    .max(2000, 'Keep it under 2000 characters'),
  kind: FeedbackKind.default('OTHER'),
  // Optional 1–5 rating shown alongside the message in the admin panel.
  rating: z.number().int().min(1, 'Ratings run 1 to 5').max(5, 'Ratings run 1 to 5').optional(),
  // Optional reply address. Empty string is allowed so a shopper can skip it.
  email: z
    .union([z.string().trim().email('Enter a valid email address'), z.literal('')])
    .optional(),
  // Where the reporter was — page path or shop slug, recorded for context.
  page: z.string().trim().max(300).optional(),
  // Storefront the report was filed from. Omit for a platform-level report.
  slug: z.string().trim().max(80).optional(),
});

export const FeedbackAck = z.object({ ok: z.literal(true) });

export type FeedbackKind = z.infer<typeof FeedbackKind>;
export type FeedbackCreateInput = z.infer<typeof FeedbackCreate>;
export type FeedbackAck = z.infer<typeof FeedbackAck>;
