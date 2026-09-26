// Server-side PLATFORM-admin gate. Use at the TOP of an operator-only Server
// Component page:
//   const session = await requireAdmin(); // redirects unless signed in AND admin
//
// This is deliberately NOT the shop gate. A signed-in shop owner runs their own
// workspace with `requireAuth`; per-shop access comes from the `userId`
// ownership columns on every business row, not from a role. This gate only marks
// the account allowed to read cross-account data (the /dashboard/admin monitor,
// which lists every account).
//
// Server-only — NEVER import this from a 'use client' file (breaks the build:
// "'server-only' cannot be imported from a Client Component"). If the page also needs
// client interactivity or loads data, keep the PAGE a Server Component that calls requireAdmin(),
// then render a 'use client' child island for the interactive part (fetch via apiFetch('/api/admin/...)').
// For an API route handler, throw a 401 Response instead (see AGENT.md) — never redirect a fetch.
// NEVER hand-roll a separate admin login, a shared password, or a custom admin cookie.

import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isAdminRole } from '@/lib/roles';

export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/login');
  if (!isAdminRole(session.user.role)) redirect('/dashboard');
  return session;
}
