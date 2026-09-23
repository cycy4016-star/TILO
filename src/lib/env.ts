import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string().url(),
    BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
    // Owner account. The first user whose email or verified phone matches these
    // gets the `admin` role (see src/lib/auth.ts). Both optional.
    ADMIN_EMAIL: z.string().optional(),
    ADMIN_PHONE: z.string().optional(),
    // Invite-code gate for sign-up (optional). When set, phone-first sign-ups
    // must submit this exact code or be rejected. Fully-verified email accounts
    // (e.g. Google sign-in) are exempt. Leave empty for open sign-up.
    SIGNUP_INVITE_CODE: z.string().optional(),

    // Automations + SMS. All optional: the app boots without them, and the
    // cron routes 404/401 when CRON_SECRET is unset. SMS actions are skipped
    // by the sweep when no provider is configured.
    CRON_SECRET: z.string().min(8).optional(),
    SMS_PROVIDER: z.enum(['bms', 'arkesel', 'none']).default('none'),
    // BMS Africa (mNotify) — the approved Ghana bulk-SMS provider.
    BMS_API_KEY: z.string().optional(),
    BMS_SENDER_ID: z.string().optional(),
    ARKESEL_API_KEY: z.string().optional(),
    ARKESEL_SENDER_ID: z.string().optional(),
    SMS_SUMMARY_RECIPIENT: z.string().optional(),
    // Cost of one SMS credit in pesewas (used for the dashboard estimate).
    SMS_COST_PER_CREDIT_PESEWAS: z.coerce.number().int().nonnegative().default(5),

    // Transactional email (optional). Phone SMS is the primary verification
    // channel; email is a secondary/fallback used for password-reset links.
    EMAIL_PROVIDER: z.enum(['resend', 'none']).default('none'),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),

    // Paystack (optional). Routes return a "not configured" error until set.
    PAYSTACK_SECRET_KEY: z.string().optional(),
    PAYSTACK_PUBLIC_KEY: z.string().optional(),
    PAYSTACK_CALLBACK_URL: z.string().url().optional(),

    // Google OAuth (optional). Lets users pick "sign in with Google" instead of
    // phone + SMS. Both must be set together or the button is hidden.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
    // Base for @/lib/api-client + proxy.ts connect-src. Default-empty
    // (unset) means same-origin `/api`; set only for an external API origin.
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
    // Shows the "Continue with Google" button on the sign-in/sign-up forms.
    // Set to 'true' (with GOOGLE_CLIENT_ID/SECRET) to offer the alternative.
    NEXT_PUBLIC_GOOGLE_AUTH: z.enum(['true', 'false']).default('false'),
    // Shows the "Invite code" field on the sign-up form. Set to 'true' and
    // pair with SIGNUP_INVITE_CODE to gate phone-first sign-ups by invite.
    NEXT_PUBLIC_SIGNUP_INVITE: z.enum(['true', 'false']).default('false'),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_GOOGLE_AUTH: process.env.NEXT_PUBLIC_GOOGLE_AUTH,
    NEXT_PUBLIC_SIGNUP_INVITE: process.env.NEXT_PUBLIC_SIGNUP_INVITE,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PHONE: process.env.ADMIN_PHONE,
    SIGNUP_INVITE_CODE: process.env.SIGNUP_INVITE_CODE,
    CRON_SECRET: process.env.CRON_SECRET,
    SMS_PROVIDER: process.env.SMS_PROVIDER,
    BMS_API_KEY: process.env.BMS_API_KEY,
    BMS_SENDER_ID: process.env.BMS_SENDER_ID,
    ARKESEL_API_KEY: process.env.ARKESEL_API_KEY,
    ARKESEL_SENDER_ID: process.env.ARKESEL_SENDER_ID,
    SMS_SUMMARY_RECIPIENT: process.env.SMS_SUMMARY_RECIPIENT,
    SMS_COST_PER_CREDIT_PESEWAS: process.env.SMS_COST_PER_CREDIT_PESEWAS,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY,
    PAYSTACK_CALLBACK_URL: process.env.PAYSTACK_CALLBACK_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  },
  emptyStringAsUndefined: true,
  // SKIP_ENV_VALIDATION=1 bypasses validation for envless builds (lint/CI/local).
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
