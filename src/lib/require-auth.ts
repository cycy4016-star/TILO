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
// Suspension is enforced HERE, not only at sign-in: a session minted before an
// account was banned would otherwise keep working until it expired. A banned
// account is treated as signed out everywhere, and its sessions (plus push
// subscriptions) are revoked on the next authenticated read.
//
// Server-only — never import from a 'use client' file. For UI gating use
// useSession() from @/lib/auth-client; for admin-only data use requireAdmin().

import 'server-only';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isSuspensionActive } from '@/lib/suspension';

export type SessionContext = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
export type SessionUser = SessionContext['user'];

/** Belt-and-braces revocation when a live session belongs to a banned account.
 *  Never throws: the caller only needs to know the account is not usable. */
async function revokeSuspendedAccount(userId: string): Promise<void> {
  try {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.pushSubscription.deleteMany({ where: { userId } });
  } catch {
    // The gate still denies access below; cleanup can retry on the next request.
  }
}

/** Session plus user, or `null` when signed out or suspended. */
export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  if (isSuspensionActive(session.user)) {
    await revokeSuspendedAccount(session.user.id);
    return null;
  }
  return session;
}

/** Returns the session user, or `null` if not signed in or suspended. Use when
 *  you need to branch on anonymous callers; use `requireSession` for authed-only
 *  routes. */
export async function getSessionUser(): Promise<SessionUser | null> {
  return (await getSessionContext())?.user ?? null;
}

/** Returns the session (user + id), or THROWS a 401 `Response` (never redirects).
 *  Use when a route needs the session id, e.g. binding push to a login. */
export async function requireSession(_req?: Request): Promise<SessionContext> {
  const context = await getSessionContext();
  if (!context) {
    throw Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return context;
}

/** Returns the session user, or THROWS a 401 `Response` (never redirects).
 *  Wrap and rethrow:
 *    try { user = await requireAuth(req); } catch (res) { return res as Response; } */
export async function requireAuth(_req?: Request): Promise<SessionUser> {
  return (await requireSession(_req)).user;
}
