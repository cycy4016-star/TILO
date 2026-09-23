// better-auth React client (v1.6.x). Client-safe: NO server secrets, NO
// server-only imports — safe to import from 'use client' components.
//
// SAME-ORIGIN: no baseURL is set, so the client calls /api/auth on whatever
// host the app is served from. An absolute baseURL baked at build time would
// make every non-primary host a cross-origin call that fails CORS. The auth
// endpoints are mounted at /api/auth/* by the catch-all route handler on that
// same origin.

import { adminClient, inferAdditionalFields, phoneNumberClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    phoneNumberClient(),
    // Mirrors `user.additionalFields` in auth-config.ts so signUp.email accepts
    // (and types) the `inviteCode` and `phoneNumber` fields sent by the sign-up
    // form. `phoneNumber` is registered by the phoneNumber plugin server-side;
    // the mirror keeps the client body typed for the OTP-free sign-up path.
    inferAdditionalFields({
      user: {
        inviteCode: { type: 'string' },
        phoneNumber: { type: 'string' },
      },
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;

/**
 * `true` when the signed-in user is an admin (`role === 'admin'`, the admin
 * plugin's field). Returns `false` while the session is still loading and for
 * logged-out visitors.
 *
 * The role lives on **`data.user.role`**. It is NOT `data.session.user.role`.
 */
export function useIsAdmin(): boolean {
  const { data } = useSession();
  return data?.user?.role === 'admin';
}
