import 'server-only';
import { APIError, betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';
import { captureAdminAlert } from '@/lib/admin-alerts';
import { authConfig } from '@/lib/auth-config';
import { recordAuthEvent } from '@/lib/auth-events';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { trialEndsAtFrom } from '@/lib/trial';

// Compose the app's hooks — don't overwrite them. `role` is a PLATFORM role:
// sign-ups default to "user" and only the account matching ADMIN_EMAIL is
// promoted to "admin". Per-shop access is not granted by role at all — it comes
// from the `userId` ownership columns (see prisma/schema), which every data
// route filters on.
const appHooks = authConfig.databaseHooks;

// Resolve the platform owner. Returns "admin" only for the account whose
// (Google-verified) email matches ADMIN_EMAIL; every other sign-up is a plain
// "user". ADMIN_EMAIL is optional — with it unset, nobody is an admin and the
// /dashboard/admin monitor is simply unreachable, which is the safe default for
// a deployment that only needs shops.
function resolveRole(email: string): 'admin' | 'user' {
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

export const auth = betterAuth({
  ...authConfig,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins,
  // Client IP resolution. Railway's edge OVERWRITES X-Real-IP with the
  // visitor's address (single value, not spoofable through the public edge),
  // while X-Forwarded-For can carry a multi-hop chain — which better-auth's
  // single-value check rejects, collapsing every visitor into one shared
  // bucket. Walk the headers in order: x-real-ip where the edge sets it,
  // x-forwarded-for as the fallback for hosts that only provide that. Local dev
  // resolves to 127.0.0.1 regardless (isDevelopment fallback in better-auth).
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['x-real-ip', 'x-forwarded-for'],
    },
  },
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
          // Pilot capacity cap (optional). Runs on EVERY create path — a hard
          // account limit is the way to hold "the first N shops". The pre-create
          // count already excludes the pending row, so `>=` is exact.
          const limit = env.SIGNUP_LIMIT;
          if (limit) {
            const count = await prisma.user.count();
            if (count >= limit) {
              throw APIError.from('FORBIDDEN', {
                code: 'SIGNUP_LIMIT_REACHED',
                message: `This pilot is limited to the first ${limit} shops and is now full.`,
              });
            }
          }
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
              // Platform role, NOT per-shop access. Shops are isolated by the
              // `userId` ownership columns; this only marks the operator who
              // may read the cross-account admin monitor.
              role: resolveRole(base.email),
              // Free trial: 30 days of the full toolkit from account creation.
              // Kept if a value already arrived (e.g. a pre-seeded backfill),
              // so this only stamps genuinely new accounts.
              trialEndsAt: base.trialEndsAt ?? trialEndsAtFrom(new Date()),
            },
          };
        },
        // Platform activity alert: the operator's ALERTS panel hears about
        // every new account the moment it lands (best-effort, never throws).
        // The permanent ledger gets its SIGNUP row at the same point.
        after: async (user) => {
          await captureAdminAlert({
            kind: 'SIGNUP',
            title: `${user.name} joined`,
            body: user.email,
            refType: 'user',
            refId: user.id,
          });
          await recordAuthEvent({ userId: user.id, kind: 'SIGNUP' });
        },
      },
    },
    // Permanent sign-in history. Session rows are deleted by better-auth on
    // sign-out / revocation / expiry; this hook copies each fresh sign-in into
    // the append-only auth_event ledger so the operator console's sign-in
    // counts and "last seen" survive them (see src/lib/auth-events.ts).
    session: {
      ...appHooks?.session,
      create: {
        ...appHooks?.session?.create,
        after: async (session) => {
          await appHooks?.session?.create?.after?.(session, null);
          await recordAuthEvent({
            userId: session.userId,
            kind: 'SIGNIN',
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
          });
        },
      },
    },
  },
  plugins: [
    admin({
      // Sign-ups are "user"; only the ADMIN_EMAIL account is an "admin"
      // (resolveRole above). defaultRole covers rows created outside the
      // sign-up path, e.g. /admin/create-user.
      defaultRole: 'user',
      adminRoles: ['admin'],
    }),
    ...(authConfig.plugins ?? []),
  ],
});
