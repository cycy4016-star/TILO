// The Admin monitor island: every Tilo account and their sign-in pulse. Renders
// only inside the admin-gated page (never fetches unless mounted there).
'use client';

import { ShieldAlert, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { AdminUserMonitor, type AdminUserMonitor as Monitor } from '@/lib/contracts/admin';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function AdminMonitor() {
  const [data, setData] = useState<Monitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/admin/users', { schema: AdminUserMonitor })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />;
  }

  if (error || !data) {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm font-semibold text-destructive">
          We could not load the account list. Please try again.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-widest text-primary">
            <ShieldCheck aria-hidden className="size-3.5" /> Admin
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground">
            <Users aria-hidden className="size-3.5" /> Accounts overview
          </span>
        </div>
        <h1 className="mt-5 text-3xl font-bold">
          Who&apos;s <span className="text-primary">active.</span>
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Every account, their sign-in activity, and the last time they signed in.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users aria-hidden className="size-5" />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Accounts
          </p>
          <p className="mt-1 text-3xl font-bold text-foreground">{data.totalUsers}</p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck aria-hidden className="size-5" />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Admins
          </p>
          <p className="mt-1 text-3xl font-bold text-foreground">{data.adminCount}</p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UserCheck aria-hidden className="size-5" />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Active this month
          </p>
          <p className="mt-1 text-3xl font-bold text-foreground">{data.activeThisMonth}</p>
        </article>
      </section>

      <section
        id="accounts-table"
        className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card"
      >
        {data.users.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ShieldAlert aria-hidden className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 text-lg font-semibold">No accounts yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Signups</th>
                  <th className="px-5 py-3">Last seen</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-3">
                      <p className="text-sm font-semibold">{user.name}</p>
                      <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-semibold">
                      {user.phone ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
                        Admin
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-semibold">
                      {user.sessionCount}
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {user.lastSeenAt ? formatDate(user.lastSeenAt) : 'Never'}
                    </td>
                    <td className="px-5 py-3">
                      {user.banned ? (
                        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-destructive">
                          Suspended
                        </span>
                      ) : (
                        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
