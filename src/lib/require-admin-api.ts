// Server-side admin gate for API route handlers. Admin = a better-auth user
// with role 'admin' (see src/lib/auth.ts). Throws a 403 Response for everyone
// else — API handlers must never redirect a fetch (use requireAdmin() from
// @/lib/require-admin in Server Components instead, which redirects).
import 'server-only';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export async function requireAdminUser(_req?: Request): Promise<SessionUser> {
  const user = await requireAuth(_req);
  if (user.role !== 'admin') {
    throw Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  return user;
}
