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
    return (
      <div className="h-64 animate-pulse rounded-[1.75rem] border-2 border-amber-950 bg-white dark:bg-stone-900" />
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-[1.75rem] border-2 border-amber-950 bg-white p-6 dark:bg-stone-900">
        <p className="font-bold text-amber-700">The roll call would not load — try again.</p>
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-950 via-[#78350f] to-yellow-600 p-8 text-amber-50 sm:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(circle at 85% 20%, #facc15 0, transparent 35%), radial-gradient(circle at 10% 90%, #fcd34d 0, transparent 30%)',
          }}
        />
        <div className="relative flex flex-wrap items-center gap-3">
          <span className="inline-flex -rotate-2 items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.18em] text-amber-950">
            <ShieldCheck aria-hidden className="size-3.5" /> Admin
          </span>
          <span className="inline-flex rotate-1 items-center gap-1.5 rounded-full border-2 border-amber-50/40 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.18em]">
            <Users aria-hidden className="size-3.5" /> The roll call
          </span>
        </div>
        <h1 className="relative mt-5 font-display text-4xl font-black uppercase leading-none sm:text-5xl">
          who&apos;s on <span className="text-amber-300">the floor.</span>
        </h1>
        <p className="relative mt-3 max-w-md font-medium text-amber-100">
          Every account, their role, and the last time they walked in.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-[1.75rem] border-2 border-amber-950 bg-white p-6 shadow-[5px_5px_0_0_#451a03] dark:bg-stone-900">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-yellow-600 text-white">
            <Users aria-hidden className="size-5" />
          </span>
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-stone-500">
            Accounts
          </p>
          <p className="mt-1 font-display text-3xl font-black uppercase leading-none text-amber-950 dark:text-amber-50">
            {data.totalUsers}
          </p>
        </article>
        <article className="-rotate-1 rounded-[1.75rem] border-2 border-amber-950 bg-white p-6 shadow-[5px_5px_0_0_#451a03] dark:bg-stone-900">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-amber-500 text-white">
            <ShieldCheck aria-hidden className="size-5" />
          </span>
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-stone-500">Bosses</p>
          <p className="mt-1 font-display text-3xl font-black uppercase leading-none text-amber-950 dark:text-amber-50">
            {data.adminCount}
          </p>
        </article>
        <article className="rotate-1 rounded-[1.75rem] border-2 border-amber-950 bg-white p-6 shadow-[5px_5px_0_0_#451a03] dark:bg-stone-900">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <UserCheck aria-hidden className="size-5" />
          </span>
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-stone-500">
            Active this month
          </p>
          <p className="mt-1 font-display text-3xl font-black uppercase leading-none text-amber-950 dark:text-amber-50">
            {data.activeThisMonth}
          </p>
        </article>
      </section>

      <section className="overflow-hidden rounded-[2rem] border-2 border-amber-950 bg-[#fffbeb] dark:bg-stone-900">
        {data.users.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ShieldAlert aria-hidden className="mx-auto size-10 text-amber-400" />
            <p className="mt-3 font-display text-xl font-black uppercase">No accounts yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b-2 border-amber-950 bg-amber-300 text-[0.7rem] font-black uppercase tracking-[0.14em] text-amber-950">
                  <th className="px-5 py-3">Peg</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Signups</th>
                  <th className="px-5 py-3">Last seen</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200 dark:divide-stone-800">
                {data.users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-3">
                      <p className="font-display text-sm font-black uppercase">{user.name}</p>
                      <p className="mt-0.5 text-[0.7rem] font-medium text-stone-500">
                        {user.email}
                      </p>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-black">{user.phone ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.7rem] font-black uppercase tracking-wide ${
                          user.role === 'admin'
                            ? 'bg-amber-950 text-amber-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-stone-800 dark:text-amber-300'
                        }`}
                      >
                        {user.role === 'admin' ? 'Boss' : 'Crew'}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-black">{user.sessionCount}</td>
                    <td className="px-5 py-3 text-sm font-medium text-stone-600 dark:text-stone-300">
                      {user.lastSeenAt ? formatDate(user.lastSeenAt) : 'Never'}
                    </td>
                    <td className="px-5 py-3">
                      {user.banned ? (
                        <span className="text-[0.7rem] font-black uppercase tracking-wide text-red-600">
                          Banned
                        </span>
                      ) : (
                        <span className="text-[0.7rem] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                          Clear
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
