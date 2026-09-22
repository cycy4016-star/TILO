// Client-safe contracts for the owner-facing SMS flows: the "send an SMS from
// the platform" composer, and the usage ledger ("SMS this month" card).
import { z } from 'zod';

// --- Dispatch: every send goes through the SmsUsage ledger and raises a
// bell notification with the result.

export const SmsDispatch = z.object({
  to: z.string().trim().min(1, 'A phone number is needed').max(40, 'Phone is too long'),
  message: z
    .string()
    .trim()
    .min(1, 'Write the message first')
    .max(320, 'Keep it under 320 characters — one low-cost SMS'),
  // Which TILO template the owner picked, stored on the notification only.
  template: z.string().trim().max(40).optional(),
});

export const SmsDispatchResult = z.object({
  ok: z.boolean(),
  providerRef: z.string().nullable(),
  error: z.string().nullable(),
});

// --- Usage: the SMS ledger the automations, OTPs and manual sends write to.

export const SmsSource = z.enum(['OTP', 'AUTOMATION', 'SUMMARY', 'MANUAL']);

export const SmsUsageOverview = z.object({
  monthSent: z.number().int().nonnegative(),
  monthFailed: z.number().int().nonnegative(),
  monthCredits: z.number().int().nonnegative(),
  monthEstimatedCostPesewas: z.number().int().nonnegative(),
  allTimeSent: z.number().int().nonnegative(),
  allTimeCredits: z.number().int().nonnegative(),
  bySource: z.array(
    z.object({
      source: SmsSource,
      sent: z.number().int().nonnegative(),
      credits: z.number().int().nonnegative(),
    }),
  ),
  recent: z.array(
    z.object({
      id: z.string(),
      to: z.string(),
      source: SmsSource,
      credits: z.number().int().nonnegative(),
      ok: z.boolean(),
      createdAt: z.string().datetime(),
    }),
  ),
});

export type SmsDispatchInput = z.infer<typeof SmsDispatch>;
export type SmsUsageOverview = z.infer<typeof SmsUsageOverview>;
