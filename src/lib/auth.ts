import 'server-only';
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthEndpoint, formCsrfMiddleware } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { parseUserOutput } from 'better-auth/db';
import { admin, phoneNumber } from 'better-auth/plugins';
import * as z from 'zod';
import { authConfig } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { toE164 } from '@/lib/phone';
import { sendSms } from '@/lib/sms';

// Compose the app's hooks — don't overwrite them. `role` is a PLATFORM role:
// sign-ups default to "user" and only the account matching ADMIN_PHONE /
// ADMIN_EMAIL is promoted to "admin". Per-shop access is not granted by role at
// all — it comes from the `userId` ownership columns (see prisma/schema), which
// every data route filters on.
const appHooks = authConfig.databaseHooks;

// Resolve the platform owner. Returns "admin" only for the account whose
// verified phone matches ADMIN_PHONE (preferred) or whose email matches
// ADMIN_EMAIL; every other sign-up is a plain "user". Both env vars are
// optional — with neither set, nobody is an admin and the /dashboard/admin
// monitor is simply unreachable, which is the safe default for a deployment
// that only needs shops.
function resolveRole(phone: string | null, email: string): 'admin' | 'user' {
  const adminPhone = env.ADMIN_PHONE?.trim();
  if (adminPhone) {
    const normalized = toE164(adminPhone);
    if (phone && phone === normalized) return 'admin';
  }
  const adminEmail = env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail && email.toLowerCase() === adminEmail) return 'admin';
  return 'user';
}

// Trusted origins for better-auth Origin/CSRF checks. baseURL's own origin is
// always trusted implicitly. Add comma-separated extra origins via
// BETTER_AUTH_TRUSTED_ORIGINS (e.g. preview deployments, custom domains).
const trustedOrigins = [
  ...(env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean) ?? []),
];

// Phone-first account creation is a two-step flow: the number is proven with an
// SMS OTP before any user row exists. The phone plugin's /phone-number/sign-in
// only signs in existing users, and the built-in /sign-up/email is disabled
// (disableSignUp) — so this plugin hosts the endpoints the sign-up form uses.
// Both paths sit under /phone-number so the phone plugin's rate limit
// (10/min/IP per path) applies to them too.
const phoneVerifiedSignUp: BetterAuthPlugin = {
  id: 'phone-verified-signup',
  endpoints: {
    // POST /phone-number/sign-up — creates the account ONLY after the OTP is
    // proven. Mirrors verifyPhoneNumberOTP then the internal signUpEmail path;
    // app databaseHooks (invite gate, E.164 + unique phone, platform role,
    // phoneNumberVerified) still run on the create.
    signUpPhone: createAuthEndpoint(
      '/phone-number/sign-up',
      {
        method: 'POST',
        body: z.object({
          name: z.string(),
          email: z.string().optional(),
          password: z.string(),
          phoneNumber: z.string(),
          inviteCode: z.string().optional(),
          code: z.string(),
        }),
        use: [formCsrfMiddleware],
      },
      async (ctx) => {
        const body = ctx.body;
        const phone = toE164(body.phoneNumber);
        if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
          throw APIError.from('BAD_REQUEST', {
            code: 'INVALID_PHONE_NUMBER',
            message: 'Invalid phone number',
          });
        }
        const minPasswordLength = ctx.context.password.config.minPasswordLength;
        if (body.password.length < minPasswordLength) {
          throw APIError.from('BAD_REQUEST', {
            code: 'PASSWORD_TOO_SHORT',
            message: 'Password too short',
          });
        }
        const maxPasswordLength = ctx.context.password.config.maxPasswordLength;
        if (body.password.length > maxPasswordLength) {
          throw APIError.from('BAD_REQUEST', {
            code: 'PASSWORD_TOO_LONG',
            message: 'Password too long',
          });
        }
        const email = body.email?.trim().toLowerCase() ?? '';
        // No email is collected for pure phone-first accounts; synthesize a
        // stable placeholder so the unique email column stays satisfied.
        const finalEmail = email.length > 0 ? email : `${phone.replace(/^\+/, '')}@phone.tilo`;
        const inviteCode = body.inviteCode ?? '';

        // Pre-check everything that would abort the create BEFORE consuming the
        // OTP, so a valid code is never burned on a request that would fail.
        const existingEmail = await ctx.context.internalAdapter.findUserByEmail(finalEmail);
        if (existingEmail) {
          throw APIError.from('UNPROCESSABLE_ENTITY', {
            code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
            message: 'User already exists. Use another email.',
          });
        }
        const existingPhone = await ctx.context.adapter.findOne({
          model: 'user',
          where: [{ field: 'phoneNumber', value: phone }],
        });
        if (existingPhone) {
          throw APIError.from('UNPROCESSABLE_ENTITY', {
            code: 'USER_ALREADY_EXISTS',
            message: 'That phone number is already in use. Sign in instead.',
          });
        }
        if (env.SIGNUP_INVITE_CODE && inviteCode !== env.SIGNUP_INVITE_CODE) {
          throw APIError.from('UNPROCESSABLE_ENTITY', {
            code: 'INVITE_CODE_INVALID',
            message: "That invite code didn't work. Try again.",
          });
        }

        // Replicate the phone plugin's verifyPhoneNumberOTP: a sent code is
        // stored as `${code}:${attempts}` under the identifier, with one
        // attempt per request and a 3-try cap before the record is deleted.
        const identifier = phone;
        const existing = await ctx.context.internalAdapter.findVerificationValue(identifier);
        if (!existing) {
          throw APIError.from('BAD_REQUEST', { code: 'OTP_NOT_FOUND', message: 'OTP not found' });
        }
        if (existing.expiresAt < new Date()) {
          await ctx.context.internalAdapter.deleteVerificationByIdentifier(identifier);
          throw APIError.from('BAD_REQUEST', { code: 'OTP_EXPIRED', message: 'OTP expired' });
        }
        const allowedAttempts = 3;
        if (Number.parseInt(existing.value.split(':')[1] ?? '0', 10) >= allowedAttempts) {
          await ctx.context.internalAdapter.deleteVerificationByIdentifier(identifier);
          throw APIError.from('FORBIDDEN', {
            code: 'TOO_MANY_ATTEMPTS',
            message: 'Too many attempts',
          });
        }
        const consumed = await ctx.context.internalAdapter.consumeVerificationValue(identifier);
        if (!consumed) {
          throw APIError.from('BAD_REQUEST', { code: 'INVALID_OTP', message: 'Invalid OTP' });
        }
        const [otpValue, attempts] = consumed.value.split(':');
        if ((attempts ?? '0') && Number.parseInt(attempts ?? '0', 10) >= allowedAttempts) {
          await ctx.context.internalAdapter.deleteVerificationByIdentifier(identifier);
          throw APIError.from('FORBIDDEN', {
            code: 'TOO_MANY_ATTEMPTS',
            message: 'Too many attempts',
          });
        }
        if (otpValue !== body.code) {
          await ctx.context.internalAdapter.createVerificationValue({
            value: `${otpValue}:${Number.parseInt(attempts ?? '0', 10) + 1}`,
            identifier,
            expiresAt: consumed.expiresAt,
          });
          throw APIError.from('BAD_REQUEST', { code: 'INVALID_OTP', message: 'Invalid OTP' });
        }

        // OTP proven — persist the user. App hooks still run on create.
        const hash = await ctx.context.password.hash(body.password);
        let createdUser: Awaited<ReturnType<typeof ctx.context.internalAdapter.createUser>>;
        try {
          createdUser = await ctx.context.internalAdapter.createUser({
            name: body.name,
            email: finalEmail,
            emailVerified: false,
            phoneNumber: phone,
            phoneNumberVerified: true,
            inviteCode,
          });
          if (!createdUser) throw new Error('createUser returned null');
        } catch (error) {
          ctx.context.logger.error('Failed to create user', error);
          throw APIError.from('UNPROCESSABLE_ENTITY', {
            code: 'FAILED_TO_CREATE_USER',
            message: 'Failed to create user',
          });
        }
        try {
          await ctx.context.internalAdapter.linkAccount({
            userId: createdUser.id,
            providerId: 'credential',
            accountId: createdUser.id,
            password: hash,
          });
        } catch (error) {
          // Avoid orphaned rows: undo the created user if account linking fails.
          await ctx.context.internalAdapter.deleteUser(createdUser.id);
          ctx.context.logger.error('Failed to link credential account', error);
          throw APIError.from('UNPROCESSABLE_ENTITY', {
            code: 'FAILED_TO_CREATE_USER',
            message: 'Failed to create user',
          });
        }
        const session = await ctx.context.internalAdapter.createSession(createdUser.id);
        if (!session) {
          throw APIError.from('BAD_REQUEST', {
            code: 'FAILED_TO_CREATE_SESSION',
            message: 'Failed to create session',
          });
        }
        await setSessionCookie(ctx, { session, user: createdUser });
        return ctx.json({
          status: true,
          token: session.token,
          user: parseUserOutput(ctx.context.options, createdUser),
        });
      },
    ),
    // POST /phone-number/check-availability — cheap "can this sign-up proceed?"
    // probe used by the form's details step BEFORE an SMS code is spent, so a
    // taken number/email or bad invite code doesn't waste a send.
    checkPhoneAvailability: createAuthEndpoint(
      '/phone-number/check-availability',
      {
        method: 'POST',
        body: z.object({
          phoneNumber: z.string(),
          email: z.string().optional(),
          inviteCode: z.string().optional(),
        }),
        use: [formCsrfMiddleware],
      },
      async (ctx) => {
        const body = ctx.body;
        const phone = toE164(body.phoneNumber);
        if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
          throw APIError.from('BAD_REQUEST', {
            code: 'INVALID_PHONE_NUMBER',
            message: 'Invalid phone number',
          });
        }
        const phoneTaken = await ctx.context.adapter.findOne({
          model: 'user',
          where: [{ field: 'phoneNumber', value: phone }],
        });
        if (phoneTaken) {
          return ctx.json({ available: false, reason: 'phone' });
        }
        // Mirror the sign-up endpoint's email synthesis so the same collision is
        // caught here, before an SMS is spent on a doomed sign-up.
        const email = body.email?.trim().toLowerCase() ?? '';
        const finalEmail = email.length > 0 ? email : `${phone.replace(/^\+/, '')}@phone.tilo`;
        const emailTaken = await ctx.context.internalAdapter.findUserByEmail(finalEmail);
        if (emailTaken) {
          return ctx.json({ available: false, reason: 'email' });
        }
        // The invite gate is server-enforced at create (databaseHooks) too, but
        // surface it here so a bad code is caught before an SMS is spent. Google
        // accounts never hit this probe (they skip the phone-first path), so the
        // Google/email-verified exemption does not apply on this endpoint.
        if (env.SIGNUP_INVITE_CODE && body.inviteCode !== env.SIGNUP_INVITE_CODE) {
          return ctx.json({ available: false, reason: 'invite' });
        }
        return ctx.json({ available: true });
      },
    ),
  },
};

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
              // Platform role, NOT per-shop access. Shops are isolated by the
              // `userId` ownership columns; this only marks the operator who
              // may read the cross-account admin monitor.
              role: resolveRole(phone, base.email),
            },
          };
        },
      },
    },
  },
  plugins: [
    admin({
      // Sign-ups are "user"; only the ADMIN_PHONE / ADMIN_EMAIL account is an
      // "admin" (resolveRole above). defaultRole covers rows created outside
      // the sign-up paths, e.g. /admin/create-user.
      defaultRole: 'user',
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
        const sent = await sendSms(
          phone,
          `Your Tilo verification code is ${code}. It expires in 5 minutes.`,
          'OTP',
        );
        // sendSms never throws (it must keep logging), so a failed delivery
        // would otherwise look like a successful send: better-auth replies
        // "code sent" and the user waits for an SMS that never arrives. Throw
        // so the /phone-number/send-otp request returns an error the form can
        // show instead of a fake success.
        if (!sent.ok) {
          throw APIError.from('BAD_REQUEST', {
            code: 'SMS_SEND_FAILED',
            message: `The confirmation code could not be sent: ${sent.error ?? 'SMS provider unavailable'}`,
          });
        }
      },
      sendPasswordResetOTP: async ({ phoneNumber: phone, code }) => {
        const sent = await sendSms(
          phone,
          `Your Tilo password reset code is ${code}. It expires in 5 minutes.`,
          'OTP',
        );
        if (!sent.ok) {
          throw APIError.from('BAD_REQUEST', {
            code: 'SMS_SEND_FAILED',
            message: `The reset code could not be sent: ${sent.error ?? 'SMS provider unavailable'}`,
          });
        }
      },
    }),
    // Verify-before-create sign-up endpoints (/phone-number/sign-up,
    // /phone-number/check-availability) hosted by this custom plugin.
    phoneVerifiedSignUp,
    ...(authConfig.plugins ?? []),
  ],
});
