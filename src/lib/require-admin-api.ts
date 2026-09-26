// Server-side PLATFORM-admin gate for API route handlers. Unlike requireAuth —
// which every signed-in shop owner passes — this requires the `admin` role
// assigned at sign-up by ADMIN_PHONE / ADMIN_EMAIL (see src/lib/roles.ts). Use it
// ONLY on routes that read across accounts (e.g. /api/admin/users).
//
// Per-shop routes should call requireAuth and then scope their queries by the
// session user's id; they must NOT use this gate, or every shop owner would need
// the admin role to use their own workspace.
//
// API handlers must throw a 401 Response for signed-out callers and a 403 for a
// signed-in non-admin, never redirect a fetch (use requireAdmin() from
// @/lib/require-admin in Server Components instead, which redirects).
import 'server-only';
import { requireAuth, type SessionUser } from '@/lib/require-auth';
import { isAdminRole } from '@/lib/roles';

export async function requireAdminUser(_req?: Request): Promise<SessionUser> {
  const user = await requireAuth(_req);
  if (!isAdminRole(user.role)) {
    throw Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  return user;
}
