// F6 · HEALTH — the incident ledger. A message a human wrote, how many times
// it fired, where it came from, the stack if you want it, and a button to clear
// it once dealt with. Live, so a new incident appears on its own.
'use client';

import { Fragment, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { AdminLogRow, AdminLogs, type AdminLogRow as LogRow } from '@/lib/contracts/admin';
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
  SearchField,
  Stat,
  Tag,
  TButton,
  TChip,
} from './terminal/primitives';
import { useLiveData } from './use-live';

const LOG_SOURCES = [
  { value: '', label: 'Everywhere' },
  { value: 'SERVER', label: 'Server' },
  { value: 'CLIENT', label: 'Browser' },
];

const LOG_STATUSES = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];

const COLUMNS = [
  { key: 'state', label: 'State' },
  { key: 'source', label: 'Src' },
  { key: 'message', label: 'Incident' },
  { key: 'route', label: 'Route' },
  { key: 'fired', label: 'Fired', right: true },
  { key: 'first', label: 'First seen', right: true },
  { key: 'last', label: 'Last seen', right: true },
  { key: 'action', label: 'Action', right: true },
];

export function HealthPanel() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (source) params.set('source', source);
  if (status) params.set('status', status);
  const suffix = params.toString();
  const feed = useLiveData(`/api/admin/logs${suffix ? `?${suffix}` : ''}`, AdminLogs);
  const logs = feed.data;

  const toggleResolved = async (row: LogRow) => {
    setBusy(row.id);
    try {
      await apiFetch('/api/admin/logs', {
        method: 'PUT',
        body: JSON.stringify({ id: row.id, resolved: !row.resolved }),
        schema: AdminLogRow,
      });
      feed.refresh();
    } catch {
      // The flip is cosmetic — a failed write leaves the list as it was.
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-[var(--t-border)] bg-[var(--t-card)] px-3 py-2">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <SearchField
            label="Search incidents"
            value={input}
            onChange={setInput}
            onSubmit={() => setQuery(input.trim())}
            placeholder="message · route · stack"
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
          State
        </span>
        {LOG_STATUSES.map((entry) => (
          <TChip
            key={entry.value}
            active={status === entry.value}
            onClick={() => setStatus(entry.value)}
          >
            {entry.label}
          </TChip>
        ))}
        <span aria-hidden className="mx-2 border-l border-[var(--t-border)]" />
        <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--t-dim)]">
          Src
        </span>
        {LOG_SOURCES.map((entry) => (
          <TChip
            key={entry.value}
            active={source === entry.value}
            onClick={() => setSource(entry.value)}
          >
            {entry.label}
          </TChip>
        ))}
      </div>

      {!logs ? (
        feed.error ? (
          <Panel code="HL" title="Incident ledger">
            <ErrorState message="Could not load the incident ledger." onRetry={feed.refresh} />
          </Panel>
        ) : (
          <Panel code="HL" title="Incident ledger">
            <p className="animate-pulse py-20 text-center text-[12px] uppercase tracking-[0.2em] text-[var(--t-faint)]">
              Reading ledger…
            </p>
          </Panel>
        )
      ) : (
        <>
          <div className="grid grid-cols-3 border border-[var(--t-border)] bg-[var(--t-card)]">
            <Stat label="Open incidents" value={logs.open} tone={logs.open > 0 ? 'red' : 'green'} />
            <Stat label="Incidents in view" value={logs.total} />
            <Stat
              label="Occurrences"
              value={logs.occurrences}
              sub="repeats folded away"
              tone="amber"
            />
          </div>

          <Panel
            code="HL"
            title="Incident ledger"
            right={<span>press STACK to open a trace</span>}
            bodyClassName="p-0"
          >
            {logs.items.length === 0 ? (
              <Empty
                title="Nothing broken"
                hint="No incidents match that filter — the ledger is clean for this view."
              />
            ) : (
              <DataTable columns={COLUMNS}>
                {logs.items.map((row) => {
                  const isOpen = !row.resolved;
                  const isOpenStack = expanded === row.id;
                  return (
                    <Fragment key={row.id}>
                      <Row>
                        <Cell>
                          <span className="flex items-center gap-1.5">
                            <Dot tone={isOpen ? 'red' : 'green'} />
                            <Tag tone={isOpen ? 'red' : 'green'}>{isOpen ? 'Open' : 'Fixed'}</Tag>
                          </span>
                        </Cell>
                        <Cell>
                          <Tag tone={row.source === 'CLIENT' ? 'cyan' : 'dim'}>
                            {row.source === 'CLIENT' ? 'browser' : 'server'}
                          </Tag>
                        </Cell>
                        <td className="max-w-0 px-3 py-2">
                          <span className="block truncate font-bold text-[var(--t-text)]">
                            {row.message}
                          </span>
                          <span className="block truncate text-[10px] text-[var(--t-faint)]">
                            {row.summary ?? row.fingerprint.slice(0, 16)}
                            {row.userId ? ` · user ${row.userId.slice(0, 8)}` : ''}
                          </span>
                        </td>
                        <Cell tone="cyan">
                          {row.method ?? '—'} {row.route ?? '—'}
                        </Cell>
                        <Cell right tone={row.count > 1 ? 'amber' : 'text'}>
                          ×{row.count}
                        </Cell>
                        <Cell right tone="dim">
                          {formatStamp(row.firstSeenAt)}
                        </Cell>
                        <Cell right tone={isOpen ? 'red' : 'dim'}>
                          {formatStamp(row.lastSeenAt)}
                        </Cell>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            {row.stack && (
                              <TButton
                                tone="dim"
                                onClick={() => setExpanded(isOpenStack ? null : row.id)}
                              >
                                {isOpenStack ? 'Hide' : 'Stack'}
                              </TButton>
                            )}
                            <TButton
                              tone={isOpen ? 'green' : 'amber'}
                              disabled={busy === row.id}
                              onClick={() => void toggleResolved(row)}
                            >
                              {isOpen ? 'Resolve' : 'Reopen'}
                            </TButton>
                          </div>
                        </td>
                      </Row>
                      {isOpenStack && (
                        <Row key={`${row.id}-stack`}>
                          <td colSpan={COLUMNS.length} className="bg-black px-3 py-3">
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border border-[var(--t-border)] bg-[var(--t-panel)] p-2 text-[10px] leading-relaxed text-[var(--t-dim)]">
                              {row.stack}
                            </pre>
                          </td>
                        </Row>
                      )}
                    </Fragment>
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
