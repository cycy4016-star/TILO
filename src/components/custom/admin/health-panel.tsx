// The error ledger. This is the panel that replaces reading a terminal: a
// message a human wrote, how many times it fired, where it came from, and a
// button to clear it once it is dealt with.
'use client';

import { Check, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';
import {
  AdminLogRow,
  AdminLogs,
  type AdminLogRow as LogRow,
  type AdminLogs as Logs,
} from '@/lib/contracts/admin';
import { Chip, formatDate, PanelFallback } from './shared';

const LOG_SOURCES = [
  { value: '', label: 'Everywhere' },
  { value: 'SERVER', label: 'Server' },
  { value: 'CLIENT', label: 'Browser' },
];

const LOG_STATUSES = [
  { value: '', label: 'All incidents' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];

export function HealthPanel() {
  const [logs, setLogs] = useState<Logs | null>(null);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (source) params.set('source', source);
      if (status) params.set('status', status);
      const suffix = params.toString();
      setLogs(
        await apiFetch(`/api/admin/logs${suffix ? `?${suffix}` : ''}`, { schema: AdminLogs }),
      );
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [query, source, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleResolved = async (row: LogRow) => {
    setBusy(row.id);
    try {
      await apiFetch('/api/admin/logs', {
        method: 'PUT',
        body: JSON.stringify({ id: row.id, resolved: !row.resolved }),
        schema: AdminLogRow,
      });
      await load();
    } catch {
      // The flip is cosmetic — a failed write leaves the list as it was.
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4">
      <form
        className="flex w-full gap-2 sm:max-w-md"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(input.trim());
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search messages, routes, stacks…"
            aria-label="Search incidents"
            className="h-11 rounded-md border-border bg-card pl-11"
          />
        </div>
        <Button type="submit" variant="outline" className="h-11 rounded-md font-semibold">
          Hunt
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {LOG_STATUSES.map((entry) => (
          <Chip
            key={entry.value}
            active={status === entry.value}
            onClick={() => setStatus(entry.value)}
          >
            {entry.label}
          </Chip>
        ))}
        <span aria-hidden className="mx-1 self-center border-l border-border" />
        {LOG_SOURCES.map((entry) => (
          <Chip
            key={entry.value}
            active={source === entry.value}
            onClick={() => setSource(entry.value)}
          >
            {entry.label}
          </Chip>
        ))}
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
      ) : failed || !logs ? (
        <PanelFallback message="Could not load the incident ledger." onRetry={() => void load()} />
      ) : (
        <>
          <p className="text-caption text-muted-foreground">
            <span className="font-semibold text-foreground">{logs.open}</span> open ·{' '}
            <span className="font-semibold text-foreground">{logs.total}</span> incidents ·{' '}
            <span className="font-semibold text-foreground">{logs.occurrences}</span> occurrences in
            view
          </p>
          {logs.items.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/40 px-6 py-12 text-center">
              <ShieldCheck aria-hidden className="mx-auto size-10 text-muted-foreground" />
              <p className="mt-3 text-h4 font-display">Nothing broken</p>
              <p className="mx-auto mt-1 max-w-sm text-small text-muted-foreground">
                No incidents match that filter — the ledger is clean for this view.
              </p>
            </div>
          ) : (
            <ol className="grid gap-2">
              {logs.items.map((row) => {
                const isOpen = !row.resolved;
                const isOpenStack = expanded === row.id;
                return (
                  <li key={row.id} className="rounded-xl border border-border bg-card p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                          isOpen ? 'bg-destructive' : 'bg-primary'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-small font-medium">{row.message}</p>
                        <p className="mt-0.5 truncate text-caption text-muted-foreground">
                          {[row.summary, row.status ? `HTTP ${row.status}` : null, row.userId]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        <p className="mt-1 text-caption text-muted-foreground">
                          fired ×{row.count} · first {formatDate(row.firstSeenAt)} · last{' '}
                          {formatDate(row.lastSeenAt)}
                        </p>
                        {row.stack && (
                          <>
                            <button
                              type="button"
                              onClick={() => setExpanded(isOpenStack ? null : row.id)}
                              className="mt-2 text-caption font-medium text-primary underline-offset-2 hover:underline"
                            >
                              {isOpenStack ? 'Hide stack' : 'Show stack'}
                            </button>
                            {isOpenStack && (
                              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted/60 p-3 text-caption font-mono text-muted-foreground">
                                {row.stack}
                              </pre>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-medium uppercase tracking-wide text-muted-foreground">
                          {row.source === 'CLIENT' ? 'browser' : 'server'}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant={isOpen ? 'outline' : 'ghost'}
                          disabled={busy === row.id}
                          onClick={() => void toggleResolved(row)}
                          className="h-8 rounded-md px-3 text-caption font-semibold"
                        >
                          {isOpen ? (
                            <>
                              <Check aria-hidden className="size-3.5" /> Resolve
                            </>
                          ) : (
                            <>
                              <RotateCcw aria-hidden className="size-3.5" /> Reopen
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
