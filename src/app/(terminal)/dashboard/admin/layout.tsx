// The Tilza Terminal: the ops console's shell — operator-only, monospace,
// black-on-amber, with a live ticker, a command line and function-key nav.
//
// This is the single choke point for every /dashboard/admin/* route — the same
// pattern the dashboard layout uses (guard once in the layout, not on every
// child page). requireAdmin() redirects a shop owner back to their workspace,
// so no section can be reached by guessing a URL. The API handlers re-check the
// role independently with requireAdminUser (403), so a client that reaches the
// shell with a stale session still gets no cross-account data.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { TerminalShell } from '@/components/custom/admin/terminal/shell';
import { requireAdmin } from '@/lib/require-admin';

export const metadata: Metadata = {
  title: 'Terminal',
  description: 'Tilza Terminal: platform-wide monitor for every shop, account, incident and event.',
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return <TerminalShell>{children}</TerminalShell>;
}
