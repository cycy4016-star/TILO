import 'server-only';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, phoneNumber } from 'better-auth/plugins';
import { authConfig } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { toE164 } from '@/lib/phone';
import { sendSms } from '@/lib/sms';

// Compose the admin grant with the app's hooks — don't overwrite them.
const appHooks = authConfig.databaseHooks;
const adminEmail = env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPhone = env.ADMIN_PHONE ? toE164(env.ADMIN_PHONE) : null;

// Promote the owner account to admin once its phone is verified. The owner is
// whoever set ADMIN_PHONE (verified identity) or ADMIN_EMAIL (matching address)
// in the environment — both are controlled by whoever deploys the app.
async function grantAdminIfOwner(
  userId: string,
  email: string | null | undefined,
  phone: string | null | undefined,
): Promise<void> {
  const emailMatch = Boolean(adminEmail && email && email.toLowerCase() === adminEmail);
  const phoneMatch = Boolean(adminPhone && phone && phone === adminPhone);
  if (!emailMatch && !phoneMatch) return;
  try {
    await prisma.user.updateMany({ where: { id: userId }, data: { role: 'admin' } });
  } catch {
    // Best-effort: never let an admin-promotion hiccup fail the verification the
    // user just completed. The owner can be promoted on a later verification.
  }
}

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
          return {
            data: {
              ...base,
              emailVerified,
              // Unverified identities never receive an administrative role,
              // including a role supplied by an application create hook.
              ...(!emailVerified
                ? { role: 'user' }
                : adminEmail === originalEmail
                  ? { role: 'admin' }
                  : {}),
            },
          };
        },
      },
      update: {
        ...appHooks?.user?.update,
        after: async (user, ctx) => {
          // Verification updates carry the full persisted user. Check the stored
          // identity again so a stale update cannot promote a changed address.
          if (adminEmail && user.emailVerified && user.email.toLowerCase() === adminEmail) {
            await prisma.user.updateMany({
              where: { id: user.id, email: user.email, emailVerified: true },
              data: { role: 'admin' },
            });
          }
          await appHooks?.user?.update?.after?.(user, ctx);
        },
      },
    },
  },
  plugins: [
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
    }),
    // Phone is the primary verified identity. OTP confirmation and password
    // reset both go out over Arkesel SMS (see src/lib/sms.ts). Email stays
    // optional — users may add one later, but it is never required to sign in.
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
      callbackOnVerification: async ({ phoneNumber: phone, user }) => {
        await grantAdminIfOwner(user.id, user.email, phone);
      },
    }),
    ...(authConfig.plugins ?? []),
  ],
});
