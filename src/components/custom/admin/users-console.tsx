// Accounts console: every Tilza account, with the two actions an operator
// needs — promote/demote a teammate to platform operator, and suspend/restore a
// sign-in. Writes go through PATCH /api/admin/users/[userId], which runs them
// through better-auth's admin plugin (so a ban also revokes live sessions).
'use client';

import { ShieldAlert, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { useSession } from '@/lib/auth-client';
import {
  AdminUserMonitor,
  AdminUserRow,
  type AdminUserMonitor as Monitor,
} from '@/lib/contracts/admin';
import { formatDate, PanelFallback, StatCard } from './shared';

export function UsersConsole() {
  const { data: session } = useSession();
  const meId = session?.user?.id ?? null;

  const [data, setData] = useState<Monitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await apiFetch('/api/admin/users', { schema: AdminUserMonitor }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (
    userId: string,
    body: { role?: 'admin' | 'user'; banned?: boolean },
    message: string,
  ) => {
    setBusy(userId);
    setFeedback(null);
    try {
      await apiFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
        schema: AdminUserRow,
      });
      setFeedback(message);
      await load();
    } catch {
      setFeedback('That change did not go through — nothing was updated.');
    } finally {
      setBusy(null);
    }
  };

  const toggleRole = (row: Monitor['users'][number], next: 'admin' | 'user') => {
    if (
      next === 'user' &&
      !window.confirm(`Remove operator access from ${row.name}? They will keep their own shop.`)
    ) {
      return;
    }
    void patch(
      row.id,
      { role: next },
      next === 'admin'
        ? `${row.name} can now manage the platform.`
        : `${row.name} is no longer a platform operator.`,
    );
  };

  const toggleBanned = (row: Monitor['users'][number], next: boolean) => {
    if (
      next &&
      !window.confirm(
        `Suspend ${row.name}? They are signed out immediately and cannot sign in until you restore them.`,
      )
    ) {
      return;
    }
    void patch(
      row.id,
      { banned: next },
      next ? `${row.name} is suspended.` : `${row.name} can sign in again.`,
    );
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />;
  }
  if (error || !data) {
    return <PanelFallback message="Could not load the account list." onRetry={() => void load()} />;
  }

  return (
    <div className="grid scroll-mt-24 gap-4 sm:gap-6">
      <section className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={Users} label="Accounts" value={String(data.totalUsers)} />
        <StatCard icon={ShieldCheck} label="Admins" value={String(data.adminCount)} />
        <StatCard icon={UserCheck} label="Active this month" value={String(data.activeThisMonth)} />
      </section>

      {feedback && (
        <output className="rounded-lg border border-border bg-primary/10 px-4 py-3 text-small font-medium text-primary">
          {feedback}
        </output>
      )}

      {data.users.length === 0 ? (
        <div className="rounded-xl bg-muted/40 px-6 py-12 text-center">
          <ShieldAlert aria-hidden className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-h4 font-display">No accounts yet</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-caption font-medium uppercase tracking-widest text-muted-foreground">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Sign-ins</th>
                  <th className="px-5 py-3">Last seen</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.users.map((row) => {
                  const isMe = row.id === meId;
                  const isAdmin = (row.role ?? '').split(',').includes('admin');
                  const isBusy = busy === row.id;
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-5 py-3">
                        <p className="text-small font-medium">
                          {row.name}
                          {isMe && (
                            <span className="ml-2 font-mono text-caption text-muted-foreground">
                              you
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-caption text-muted-foreground">
                          {row.email}
                        </p>
                        <p className="mt-0.5 font-mono text-caption text-muted-foreground">
                          {row.phone ?? 'no phone'}
                        </p>
                      </td>
                      <td className="px-5 py-3 font-mono text-small font-semibold">
                        {row.sessionCount}
                      </td>
                      <td className="px-5 py-3 text-small text-muted-foreground">
                        {row.lastSeenAt ? formatDate(row.lastSeenAt) : 'Never'}
                      </td>
                      <td className="px-5 py-3">
                        {row.banned ? (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-caption font-medium uppercase tracking-wide text-destructive">
                            Suspended
                          </span>
                        ) : (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium uppercase tracking-wide text-primary">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-caption font-medium uppercase tracking-wide ${
                            isAdmin
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {isAdmin ? 'Operator' : 'Owner'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy || isMe}
                            onClick={() => toggleRole(row, isAdmin ? 'user' : 'admin')}
                            className="h-8 rounded-md px-3 text-caption font-semibold"
                            title={isMe ? 'You cannot change your own role' : undefined}
                          >
                            {isAdmin ? 'Make owner' : 'Make operator'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={row.banned ? 'default' : 'destructive'}
                            disabled={isBusy || isMe}
                            onClick={() => toggleBanned(row, !row.banned)}
                            className="h-8 rounded-md px-3 text-caption font-semibold"
                            title={isMe ? 'You cannot suspend yourself' : undefined}
                          >
                            {row.banned ? 'Restore' : 'Suspend'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
