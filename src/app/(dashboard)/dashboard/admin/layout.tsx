// The ops console shell: operator-only, with its own header and section nav.
//
// This is the single choke point for every /dashboard/admin/* route — the same
// pattern the dashboard layout uses (guard once in the layout, not on every
// child page). requireAdmin() redirects a shop owner back to their workspace,
// so no section can be reached by guessing a URL. The API handlers re-check the
// role independently with requireAdminUser (403), so a client that reaches the
// shell with a stale session still gets no cross-account data.

import { Activity, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ConsoleNav } from '@/components/custom/admin/console-nav';
import { requireAdmin } from '@/lib/require-admin';

export const metadata: Metadata = {
  title: 'Console',
  description: 'Platform control center: every shop, account, incident and event.',
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-border bg-card p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-caption font-medium uppercase tracking-wide text-primary">
            <ShieldCheck aria-hidden className="size-3.5" /> Admin
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-caption font-medium uppercase tracking-wide text-muted-foreground">
            <Activity aria-hidden className="size-3.5" /> Control center
          </span>
        </div>
        <h1 className="mt-4 break-words font-display text-h1">
          Mission <span className="text-primary">control.</span>
        </h1>
        <p className="mt-2 max-w-md text-body text-muted-foreground">
          Every shop, product, account, order, incident and word of feedback — live, in one room.
        </p>
      </section>

      <ConsoleNav />
      {children}
    </div>
  );
}
