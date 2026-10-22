import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string().url(),
    BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
    // Owner account. The first user whose email matches this gets the `admin`
    // role (see src/lib/auth.ts). Optional.
    ADMIN_EMAIL: z.string().optional(),
    // Invite-code gate for sign-up (optional). When set, sign-ups that are not
    // from a fully-verified email (i.e. not Google) must submit this exact code
    // or be rejected. Leave empty for open sign-up.
    SIGNUP_INVITE_CODE: z.string().optional(),
    // Hard cap on the number of accounts (optional). When set, sign-up is
    // rejected once this many users exist — the "first N shops" gate for a
    // pilot.
    SIGNUP_LIMIT: z.coerce.number().int().positive().optional(),

    // Transactional email (optional). Used for password-reset links when an
    // account has a credential password; no-op until configured.
    EMAIL_PROVIDER: z.enum(['resend', 'none']).default('none'),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    // Shared secret for the scheduled merchant digest endpoint.
    CRON_SECRET: z.string().optional(),

    // Web Push (optional). Generate once with `npx web-push generate-vapid-keys`.
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional(),

    // Paystack (optional). Routes return a "not configured" error until set.
    PAYSTACK_SECRET_KEY: z.string().optional(),
    PAYSTACK_PUBLIC_KEY: z.string().optional(),
    PAYSTACK_CALLBACK_URL: z.string().url().optional(),

    // Google OAuth (optional). The identity provider: users sign in / sign up
    // with Google. Both must be set together or the button is disabled.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
    // Base for @/lib/api-client + proxy.ts connect-src. Default-empty
    // (unset) means same-origin `/api`; set only for an external API origin.
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
    // Shows the "Continue with Google" button on the sign-in/sign-up forms.
    // Set to 'true' (with GOOGLE_CLIENT_ID/SECRET) to enable Google sign-in.
    NEXT_PUBLIC_GOOGLE_AUTH: z.enum(['true', 'false']).default('false'),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_GOOGLE_AUTH: process.env.NEXT_PUBLIC_GOOGLE_AUTH,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    SIGNUP_INVITE_CODE: process.env.SIGNUP_INVITE_CODE,
    SIGNUP_LIMIT: process.env.SIGNUP_LIMIT,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    CRON_SECRET: process.env.CRON_SECRET,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
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
