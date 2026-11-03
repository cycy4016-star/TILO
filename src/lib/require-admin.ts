// Server-side PLATFORM-admin gate. Use at the TOP of an operator-only Server
// Component page:
//   const { user } = await requireAdmin(); // redirects unless signed in AND admin
//
// This is deliberately NOT the shop gate. A signed-in shop owner runs their own
// workspace with `requireAuth`; per-shop access comes from the `userId`
// ownership columns on every business row, not from a role. This gate only marks
// the account allowed to read cross-account data (the /dashboard/admin monitor,
// which lists every account).
//
// The account is resolved through getSessionUser(), so a suspended admin is
// treated as signed out before the role is even considered.
//
// Server-only — NEVER import this from a 'use client' file (breaks the build:
// "'server-only' cannot be imported from a Client Component"). If the page also needs
// client interactivity or loads data, keep the PAGE a Server Component that calls requireAdmin(),
// then render a 'use client' child island for the interactive part (fetch via apiFetch('/api/admin/...)').
// For an API route handler, throw a 401 Response instead (see AGENT.md) — never redirect a fetch.
// NEVER hand-roll a separate admin login, a shared password, or a custom admin cookie.

import 'server-only';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/require-auth';
import { isAdminRole } from '@/lib/roles';

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!isAdminRole(user.role)) redirect('/dashboard');
  return { user };
}
