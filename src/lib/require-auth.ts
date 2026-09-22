// Server-side auth gate for any signed-in user.
// Use in API route handlers serving per-user data; copyable example at
// src/app/api/customers/route.ts.
//
//   import { requireAuth, type SessionUser } from '@/lib/require-auth';
//   export async function GET(req: Request) {
//     let user: SessionUser;
//     try { user = await requireAuth(req); } catch (res) { return res as Response; }
//     const items = await prisma.item.findMany({ where: { userId: user.id } });
//     return Response.json({ items });
//   }
//
// Server-only — never import from a 'use client' file. For UI gating use
// useSession() from @/lib/auth-client; for admin-only data use requireAdmin().

import 'server-only';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export type SessionUser = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>['user'];

/** Returns the session user, or `null` if not signed in. Use when you need to
 *  branch on anonymous callers; use `requireAuth` for authed-only routes. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/** Returns the session user, or THROWS a 401 `Response` (never redirects).
 *  Wrap and rethrow:
 *    try { user = await requireAuth(req); } catch (res) { return res as Response; } */
export async function requireAuth(_req?: Request): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // No unverified identities past the door. An aborted sign-up (created but
  // never confirmed a phone or email) must not reach any workspace API.
  if (!user.phoneNumberVerified && !user.emailVerified) {
    throw Response.json({ error: 'Verify your phone to continue' }, { status: 403 });
  }
  return user;
}
