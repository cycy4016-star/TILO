import 'server-only';
import { APIError, betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, phoneNumber } from 'better-auth/plugins';
import { authConfig } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { toE164 } from '@/lib/phone';
import { sendSms } from '@/lib/sms';

// Compose the app's hooks — don't overwrite them. Every account is a sole owner
// of the shop: the `admin` role is granted to all sign-ups (user.create.before).
const appHooks = authConfig.databaseHooks;

// Trusted origins for better-auth Origin/CSRF checks. baseURL's own origin is
// always trusted implicitly. Add comma-separated extra origins via
// BETTER_AUTH_TRUSTED_ORIGINS (e.g. preview deployments, custom domains).
const trustedOrigins = [
  ...(env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean) ?? []),
];

export const auth = betterAuth({
  ...authConfig,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins,
  // Better Auth's verification callback can write the pre-verification user to
  // its cookie cache. Always read authorization state from the session store.
  session: {
    ...authConfig.session,
    cookieCache: { ...authConfig.session?.cookieCache, enabled: false },
  },
  databaseHooks: {
    ...appHooks,
    user: {
      ...appHooks?.user,
      create: {
        ...appHooks?.user?.create,
        before: async (user, ctx) => {
          // Invite-code gate (optional). When SIGNUP_INVITE_CODE is set, only
          // sign-ups that present the exact code get through. Fully-verified
          // email identities (Google OAuth) are trusted and exempt. Returning
          // `false` aborts the sign-up before anything is persisted.
          if (env.SIGNUP_INVITE_CODE && user.emailVerified !== true) {
            if (user.inviteCode !== env.SIGNUP_INVITE_CODE) return false;
          }
          // Capture the SDK's identity before application hooks can mutate it.
          const originalEmail = user.email.toLowerCase();
          const originallyVerified = user.emailVerified === true;
          const r = await appHooks?.user?.create?.before?.(user, ctx);
          if (r === false) return false;
          const base = { ...user, ...(r && typeof r === 'object' && 'data' in r ? r.data : {}) };
          const emailVerified =
            originallyVerified &&
            base.emailVerified === true &&
            base.email.toLowerCase() === originalEmail;
          // OTP confirmation is ON: the phone is only trusted once the user
          // proves it by SMS code (rendered by the sign-up form / /verify ramp),
          // so never mark it verified here. Normalize to E.164 and keep the
          // unique check — a number already claimed by another account is
          // rejected up front.
          const phone = typeof base.phoneNumber === 'string' ? toE164(base.phoneNumber) : null;
          if (phone) {
            const taken = await prisma.user.findFirst({ where: { phoneNumber: phone } });
            if (taken) {
              throw APIError.from('UNPROCESSABLE_ENTITY', {
                code: 'USER_ALREADY_EXISTS',
                message: 'That phone number is already in use. Sign in instead.',
              });
            }
          }
          return {
            data: {
              ...base,
              emailVerified,
              phoneNumber: phone,
              phoneNumberVerified: base.phoneNumberVerified === true,
              // Every account is a sole owner of the shop: grant the admin role
              // to all sign-ups. There is no crew/user tier — each user has the
              // full switchboard, automations and dashboards from day one.
              role: 'admin',
            },
          };
        },
      },
    },
  },
  plugins: [
    admin({
      // Every account is a sole owner: the admin role is assigned on creation
      // (see user.create.before), so the default (used for API-created users)
      // matches.
      defaultRole: 'admin',
      adminRoles: ['admin'],
    }),
    // Phone is the primary identity. OTP confirmation is ON: every phone-first
    // account proves the number with an SMS code sent by the active SMS
    // provider (BMS) before the workspace opens. The sign-up form runs the
    // code step; the /verify page is the rescue ramp. SMS OTP also powers the
    // "forgot password" reset (sendPasswordResetOTP).
    phoneNumber({
      otpLength: 6,
      expiresIn: 300,
      requireVerification: true,
      phoneNumberValidator: (value) => /^\+[1-9]\d{6,14}$/.test(value),
      sendOTP: async ({ phoneNumber: phone, code }) => {
        await sendSms(
          phone,
          `Your Tilo verification code is ${code}. It expires in 5 minutes.`,
          'OTP',
        );
      },
      sendPasswordResetOTP: async ({ phoneNumber: phone, code }) => {
        await sendSms(
          phone,
          `Your Tilo password reset code is ${code}. It expires in 5 minutes.`,
          'OTP',
        );
      },
    }),
    ...(authConfig.plugins ?? []),
  ],
});
