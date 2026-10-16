// Configure better-auth here (spread into betterAuth() by @/lib/auth).
// Add emailAndPassword options, plugins, session, socialProviders, databaseHooks, etc.
//
// NOTE: Google OAuth is the only account-creation path. The email+password
// provider stays enabled for sign-IN (existing credential accounts and the
// local dev-login bypass) but its self-service sign-up is disabled, and the
// reset link below only fires when an email provider is configured.

import type { BetterAuthOptions } from 'better-auth';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { env } from '@/lib/env';

export const authConfig: BetterAuthOptions = {
  // The invite code is collected on the user at sign-up (extra column on
  // prisma/schema/auth.prisma.User). Enforcement lives in the user.create.before
  // hook (src/lib/auth.ts): when SIGNUP_INVITE_CODE is set, sign-ups that are
  // not from a fully-verified email (i.e. not Google) are rejected unless the
  // submitted code matches.
  user: {
    additionalFields: {
      inviteCode: { type: 'string', required: false, input: true, defaultValue: '' },
      // Free-trial end date. Server-set only (input: false) — the user.create
      // before-hook in src/lib/auth.ts stamps it; clients can never move it.
      trialEndsAt: { type: 'date', required: false, input: false },
    },
  },
  emailAndPassword: {
    enabled: true,
    // Accounts are created only through Google OAuth. The built-in
    // `/sign-up/email` route is disabled so it can't create an unverified
    // account behind the form's back; sign-in by email/password stays open for
    // any pre-existing credential account.
    disableSignUp: true,
    async sendResetPassword({ user, url }) {
      // No email provider → silently skip; users reset via SMS OTP instead.
      if (!isEmailConfigured()) return;
      await sendEmail({
        to: user.email,
        subject: 'Reset your Tilza password',
        text: `We got a request to reset your Tilza password.\n\nOpen this link to choose a new one:\n${url}\n\nIf you did not ask for this, ignore this email.`,
      });
    },
  },
  // Google OAuth — the identity path. A Google-verified email is trusted on its
  // own (no separate OTP step). Enabled only when both GOOGLE_CLIENT_ID and
  // GOOGLE_CLIENT_SECRET are set.
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
