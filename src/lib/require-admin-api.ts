// Server-side owner gate for API route handlers. Every signed-in user is a sole
// owner of the shop (see src/lib/auth.ts), so this is just requireAuth — kept as
// a named alias so owner-only routes read loudly. API handlers must throw a 401
// Response for signed-out callers, never redirect a fetch (use requireAdmin()
// from @/lib/require-admin in Server Components instead, which redirects).
import 'server-only';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export async function requireAdminUser(_req?: Request): Promise<SessionUser> {
  return requireAuth(_req);
}
