// Server-side owner gate. Every signed-in user is a sole owner of the shop (see
// src/lib/auth.ts, which grants `admin` to every account at create time). Use at
// the TOP of an owner Server Component page:
//   const session = await requireAdmin(); // redirects unless a user is signed in
// Server-only — NEVER import this from a 'use client' file (breaks the build:
// "'server-only' cannot be imported from a Client Component"). If the page also needs
// client interactivity or loads data, keep the PAGE a Server Component that calls requireAdmin(),
// then render a 'use client' child island for the interactive part (fetch via apiFetch('/api/admin/...')).
// For an API route handler, throw a 401 Response instead (see AGENT.md) — never redirect a fetch.
// NEVER hand-roll a separate admin login, a shared password, or a custom admin cookie.

import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/login');
  return session;
}
