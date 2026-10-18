// F3 · ACCOUNTS — every Tilza account, with the two actions an operator needs:
// promote/demote a platform operator, and suspend/restore a sign-in. Writes go
// through PATCH /api/admin/users/[userId], which runs them through
// better-auth's admin plugin (so a ban also revokes live sessions).
'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useSession } from '@/lib/auth-client';
import { AdminUserMonitor, AdminUserRow } from '@/lib/contracts/admin';
import {
  Cell,
  DataTable,
  Dot,
  Empty,
  ErrorState,
  formatStamp,
  LivePill,
  Panel,
  Row,
  Stat,
  Tag,
  TButton,
  TONE,
} from './terminal/primitives';
import { useLiveData } from './use-live';

export function UsersConsole() {
  const { data: session } = useSession();
  const meId = session?.user?.id ?? null;

  const feed = useLiveData('/api/admin/users', AdminUserMonitor);
  const data = feed.data;

  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'green' | 'red'; text: string } | null>(null);

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
      setFeedback({ tone: 'green', text: message });
      feed.refresh();
    } catch {
      setFeedback({ tone: 'red', text: 'That change did not go through — nothing was updated.' });
    } finally {
      setBusy(null);
    }
  };

  const toggleRole = (row: AdminUserRow, next: 'admin' | 'user') => {
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

  const toggleBanned = (row: AdminUserRow, next: boolean) => {
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

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-[var(--t-border)] bg-[var(--t-card)] px-3 py-2">
        <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--t-dim)]">
          Identity ledger · bans revoke live sessions
        </span>
        <LivePill
          live={feed.live}
          updatedAt={feed.updatedAt}
          onToggle={feed.live ? feed.pause : feed.resume}
          onRefresh={feed.refresh}
        />
      </div>

      {!data ? (
        feed.error ? (
          <Panel code="AC" title="Account ledger">
            <ErrorState message="Could not load the account list." onRetry={feed.refresh} />
          </Panel>
        ) : (
          <Panel code="AC" title="Account ledger">
            <p className="animate-pulse py-20 text-center text-[12px] uppercase tracking-[0.2em] text-[var(--t-faint)]">
              Loading accounts…
            </p>
          </Panel>
        )
      ) : (
        <>
          <div className="grid grid-cols-3 border border-[var(--t-border)] bg-[var(--t-card)]">
            <Stat label="Accounts" value={data.totalUsers} tone="text" />
            <Stat label="Operators" value={data.adminCount} tone="amber" />
            <Stat label="Active this month" value={data.activeThisMonth} tone="green" />
          </div>

          {feedback && (
            <output
              className={`border px-2 py-1 text-[11px] font-bold ${
                feedback.tone === 'green'
                  ? 'border-[var(--t-green)] text-[var(--t-green)]'
                  : 'border-[var(--t-red)] text-[var(--t-red)]'
              }`}
            >
              {feedback.tone === 'green' ? 'OK  ' : 'ERR '}
              {feedback.text}
            </output>
          )}

          <Panel
            code="AC"
            title="Account ledger"
            right={<span>{data.users.length} accounts</span>}
            bodyClassName="p-0"
          >
            {data.users.length === 0 ? (
              <Empty title="No accounts yet" hint="Sign-ups land here the moment they happen." />
            ) : (
              <DataTable
                columns={[
                  { key: 'name', label: 'Account' },
                  { key: 'sessions', label: 'Sign-ins', right: true },
                  { key: 'seen', label: 'Last seen', right: true },
                  { key: 'status', label: 'Status' },
                  { key: 'role', label: 'Role' },
                  { key: 'actions', label: 'Actions', right: true },
                ]}
              >
                {data.users.map((row) => {
                  const isMe = row.id === meId;
                  const isAdmin = (row.role ?? '').split(',').includes('admin');
                  const isBusy = busy === row.id;
                  return (
                    <Row key={row.id}>
                      <td className="max-w-0 px-3 py-2">
                        <span className="flex items-baseline gap-1.5">
                          <span className="truncate font-bold text-[var(--t-text)]">
                            {row.name}
                          </span>
                          {isMe && <span className="text-[10px] text-[var(--t-amber)]">you</span>}
                        </span>
                        <span className="block truncate text-[10px] text-[var(--t-cyan)]">
                          {row.email}
                        </span>
                        <span className="block truncate text-[10px] text-[var(--t-faint)]">
                          {row.phone ?? 'no phone'}
                        </span>
                      </td>
                      <Cell right tone={row.signInCount > 0 ? 'text' : 'faint'}>
                        {row.signInCount}
                      </Cell>
                      <Cell right tone="dim">
                        {row.lastSeenAt ? formatStamp(row.lastSeenAt) : 'never'}
                      </Cell>
                      <Cell>
                        {row.banned ? (
                          <Tag tone="red">Suspended</Tag>
                        ) : (
                          <Tag tone="green">Active</Tag>
                        )}
                      </Cell>
                      <Cell>
                        <span className="flex items-center gap-1.5">
                          <Dot tone={isAdmin ? 'amber' : 'dim'} />
                          <span className={isAdmin ? TONE.amber : TONE.dim}>
                            {isAdmin ? 'Operator' : 'Owner'}
                          </span>
                        </span>
                      </Cell>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <TButton
                            tone="dim"
                            disabled={isBusy || isMe}
                            onClick={() => toggleRole(row, isAdmin ? 'user' : 'admin')}
                          >
                            {isAdmin ? 'Demote' : 'Promote'}
                          </TButton>
                          <TButton
                            tone={row.banned ? 'green' : 'red'}
                            disabled={isBusy || isMe}
                            onClick={() => toggleBanned(row, !row.banned)}
                          >
                            {row.banned ? 'Restore' : 'Suspend'}
                          </TButton>
                        </div>
                      </td>
                    </Row>
                  );
                })}
              </DataTable>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
