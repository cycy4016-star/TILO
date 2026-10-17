// F7 · FEEDBACK — what users actually said, triaged NEW → SEEN → RESOLVED.
'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { AdminFeedbackList, AdminFeedbackRow, AdminFeedbackStatus } from '@/lib/contracts/admin';
import {
  Cell,
  DataTable,
  Empty,
  ErrorState,
  formatStamp,
  LivePill,
  Panel,
  Row,
  SearchField,
  Stat,
  Tag,
  TButton,
  TChip,
  type Tone,
} from './terminal/primitives';
import { useLiveData } from './use-live';

const STATUS_TONE: Record<string, Tone> = {
  NEW: 'amber',
  SEEN: 'cyan',
  RESOLVED: 'green',
};

type FeedbackStatusValue = (typeof AdminFeedbackStatus.options)[number];

export function FeedbackPanel() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (status) params.set('status', status);
  const suffix = params.toString();
  const feed = useLiveData(`/api/admin/feedback${suffix ? `?${suffix}` : ''}`, AdminFeedbackList);
  const data = feed.data;

  const moveStatus = async (row: AdminFeedbackRow, next: FeedbackStatusValue) => {
    setBusy(row.id);
    try {
      await apiFetch('/api/admin/feedback', {
        method: 'PUT',
        body: JSON.stringify({ id: row.id, status: next }),
        schema: AdminFeedbackRow,
      });
      feed.refresh();
    } catch {
      // Leave the row as it was; the list is still valid.
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-[var(--t-border)] bg-[var(--t-card)] px-3 py-2">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <SearchField
            label="Search feedback"
            value={input}
            onChange={setInput}
            onSubmit={() => setQuery(input.trim())}
            placeholder="message · page · email"
          />
        </div>
        <LivePill
          live={feed.live}
          updatedAt={feed.updatedAt}
          onToggle={feed.live ? feed.pause : feed.resume}
          onRefresh={feed.refresh}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1 border border-[var(--t-border)] bg-[var(--t-card)] px-3 py-2">
        <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--t-dim)]">
          Triage
        </span>
        {[
          { value: '', label: 'Everything' },
          ...AdminFeedbackStatus.options.map((value) => ({ value, label: value })),
        ].map((entry) => (
          <TChip
            key={entry.value}
            active={status === entry.value}
            onClick={() => setStatus(entry.value)}
          >
            {entry.label}
          </TChip>
        ))}
      </div>

      {!data ? (
        feed.error ? (
          <Panel code="FB" title="Feedback queue">
            <ErrorState message="Could not load the feedback queue." onRetry={feed.refresh} />
          </Panel>
        ) : (
          <Panel code="FB" title="Feedback queue">
            <p className="animate-pulse py-20 text-center text-[12px] uppercase tracking-[0.2em] text-[var(--t-faint)]">
              Loading queue…
            </p>
          </Panel>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 border border-[var(--t-border)] bg-[var(--t-card)]">
            <Stat
              label="Untriaged"
              value={data.newCount}
              tone={data.newCount > 0 ? 'amber' : 'green'}
            />
            <Stat label="In queue" value={data.total} />
          </div>

          <Panel
            code="FB"
            title="Feedback queue"
            right={<span>press a state to move a note</span>}
            bodyClassName="p-0"
          >
            {data.items.length === 0 ? (
              <Empty
                title="No feedback here"
                hint="Nothing matches that filter — try another state or clear the search."
              />
            ) : (
              <DataTable
                columns={[
                  { key: 'state', label: 'State' },
                  { key: 'kind', label: 'Kind' },
                  { key: 'message', label: 'Note' },
                  { key: 'from', label: 'From' },
                  { key: 'when', label: 'When', right: true },
                  { key: 'actions', label: 'Move to', right: true },
                ]}
              >
                {data.items.map((row) => (
                  <Row key={row.id}>
                    <Cell>
                      <Tag tone={STATUS_TONE[row.status] ?? 'dim'}>{row.status}</Tag>
                    </Cell>
                    <Cell tone="dim">
                      <span className="uppercase">{row.kind}</span>
                    </Cell>
                    <td className="max-w-0 px-3 py-2">
                      <span className="block truncate font-bold text-[var(--t-text)]">
                        {row.message}
                      </span>
                      <span className="block truncate text-[10px] text-[var(--t-faint)]">
                        {[row.page, row.shop, row.email].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </td>
                    <Cell tone="cyan">{row.reporter ?? 'anonymous'}</Cell>
                    <Cell right tone="dim">
                      {formatStamp(row.createdAt)}
                      {row.rating != null && (
                        <span className="ml-1 text-[var(--t-amber)]">★{row.rating}</span>
                      )}
                    </Cell>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {AdminFeedbackStatus.options.map((option) => (
                          <TButton
                            key={option}
                            tone={STATUS_TONE[option] ?? 'dim'}
                            active={row.status === option}
                            disabled={busy === row.id || row.status === option}
                            onClick={() => void moveStatus(row, option)}
                          >
                            {option.slice(0, 3)}
                          </TButton>
                        ))}
                      </div>
                    </td>
                  </Row>
                ))}
              </DataTable>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
