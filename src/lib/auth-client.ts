// better-auth React client (v1.6.x). Client-safe: NO server secrets, NO
// server-only imports — safe to import from 'use client' components.
//
// SAME-ORIGIN: no baseURL is set, so the client calls /api/auth on whatever
// host the app is served from. An absolute baseURL baked at build time would
// make every non-primary host a cross-origin call that fails CORS. The auth
// endpoints are mounted at /api/auth/* by the catch-all route handler on that
// same origin.

import { adminClient, inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    // Mirrors `user.additionalFields` in auth-config.ts so the client body is
    // typed for the fields the sign-up flow sends.
    inferAdditionalFields({
      user: {
        inviteCode: { type: 'string' },
        // Server-set free-trial end date, surfaced read-only on the session so
        // the dashboard can show the days-left banner.
        trialEndsAt: { type: 'date' },
      },
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;

/**
 * `true` only for a PLATFORM admin — the account promoted at sign-up by
 * ADMIN_EMAIL. This is not "is this a shop owner": every signed-in
 * account owns its own workspace and runs the full dashboard without any role.
 * Use it to reveal cross-account UI (the /dashboard/admin account monitor).
 *
 * Returns `false` while the session is still loading and for ordinary users. The
 * role lives on **`data.user.role`**; it is NOT `data.session.user.role`.
 */
export function useIsAdmin(): boolean {
  const { data } = useSession();
  if (!data?.user) return false;
  const role = (data.user as { role?: string | null }).role;
  if (!role) return false;
  return role
    .split(',')
    .map((part) => part.trim())
    .includes('admin');
}
