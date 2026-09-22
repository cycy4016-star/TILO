// Configure better-auth here (spread into betterAuth() by @/lib/auth).
// Add emailAndPassword options, plugins, session, socialProviders, databaseHooks, etc.
//
// NOTE: email is optional in this app. Phone SMS (the phoneNumber plugin in
// src/lib/auth.ts) is the primary verification + password-reset channel. The
// email reset link below only fires when an email provider is configured.

import type { BetterAuthOptions } from 'better-auth';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { env } from '@/lib/env';

export const authConfig: BetterAuthOptions = {
  // The invite code is collected on the user at sign-up (extra column on
  // prisma/schema/auth.prisma.User). Enforcement lives in the user.create.before
  // hook (src/lib/auth.ts): when SIGNUP_INVITE_CODE is set, phone-first sign-ups
  // are rejected unless the submitted code matches. Filled when the sign-up
  // form sends `inviteCode` as an additional field.
  user: {
    additionalFields: {
      inviteCode: { type: 'string', required: false, input: true, defaultValue: '' },
    },
  },
  emailAndPassword: {
    enabled: true,
    async sendResetPassword({ user, url }) {
      // No email provider → silently skip; users reset via SMS OTP instead.
      if (!isEmailConfigured()) return;
      await sendEmail({
        to: user.email,
        subject: 'Reset your Tilo password',
        text: `We got a request to reset your Tilo password.\n\nOpen this link to choose a new one:\n${url}\n\nIf you did not ask for this, ignore this email.`,
      });
    },
  },
  // Google OAuth — the alternate identity path. Users pick phone+SMS *or*
  // Google when signing up/in; each option is self-verifying (SMS OTP for
  // phone, Google-verified email for Google). Enabled only when both
  // GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
};
