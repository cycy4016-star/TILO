// What users actually said, triaged NEW → SEEN → RESOLVED.
'use client';

import { MessageSquareText, Search, Star } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';
import {
  AdminFeedbackList,
  AdminFeedbackRow,
  AdminFeedbackStatus,
  type AdminFeedbackList as Feedback,
  type AdminFeedbackRow as FeedbackRow,
} from '@/lib/contracts/admin';
import { Chip, formatDate, PanelFallback } from './shared';

const FEEDBACK_STATUSES = [
  { value: '', label: 'Everything' },
  { value: 'NEW', label: 'New' },
  { value: 'SEEN', label: 'Seen' },
  { value: 'RESOLVED', label: 'Resolved' },
];

type FeedbackStatusValue = (typeof AdminFeedbackStatus.options)[number];

export function FeedbackPanel() {
  const [data, setData] = useState<Feedback | null>(null);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (status) params.set('status', status);
      const suffix = params.toString();
      setData(
        await apiFetch(`/api/admin/feedback${suffix ? `?${suffix}` : ''}`, {
          schema: AdminFeedbackList,
        }),
      );
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const moveStatus = async (row: FeedbackRow, next: FeedbackStatusValue) => {
    setBusy(row.id);
    try {
      await apiFetch('/api/admin/feedback', {
        method: 'PUT',
        body: JSON.stringify({ id: row.id, status: next }),
        schema: AdminFeedbackRow,
      });
      await load();
    } catch {
      // Leave the row as it was; the list is still valid.
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
            placeholder="Search messages, pages, emails…"
            aria-label="Search feedback"
            className="h-11 rounded-md border-border bg-card pl-11"
          />
        </div>
        <Button type="submit" variant="outline" className="h-11 rounded-md font-semibold">
          Hunt
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {FEEDBACK_STATUSES.map((entry) => (
          <Chip
            key={entry.value}
            active={status === entry.value}
            onClick={() => setStatus(entry.value)}
          >
            {entry.label}
          </Chip>
        ))}
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
      ) : failed || !data ? (
        <PanelFallback message="Could not load the feedback queue." onRetry={() => void load()} />
      ) : (
        <>
          <p className="text-caption text-muted-foreground">
            <span className="font-semibold text-foreground">{data.newCount}</span> new ·{' '}
            <span className="font-semibold text-foreground">{data.total}</span> in the queue
          </p>
          {data.items.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/40 px-6 py-12 text-center">
              <MessageSquareText aria-hidden className="mx-auto size-10 text-muted-foreground" />
              <p className="mt-3 text-h4 font-display">No feedback here</p>
              <p className="mx-auto mt-1 max-w-sm text-small text-muted-foreground">
                Nothing matches that filter yet — try another status or clear the search.
              </p>
            </div>
          ) : (
            <ol className="grid gap-2">
              {data.items.map((row) => (
                <li key={row.id} className="rounded-xl border border-border bg-card p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-medium uppercase tracking-wide text-muted-foreground">
                          {row.kind}
                        </span>
                        {row.rating != null && (
                          <span className="inline-flex items-center gap-1 text-caption font-medium text-primary">
                            <Star aria-hidden className="size-3.5" />
                            {row.rating}/5
                          </span>
                        )}
                      </p>
                      <p className="mt-2 break-words text-small">{row.message}</p>
                      <p className="mt-1 truncate text-caption text-muted-foreground">
                        {[row.reporter, row.email, row.shop, row.page].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-1 text-caption text-muted-foreground">
                        {formatDate(row.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        {AdminFeedbackStatus.options.map((option) => (
                          <button
                            key={option}
                            type="button"
                            disabled={busy === row.id || row.status === option}
                            onClick={() => void moveStatus(row, option)}
                            className={`rounded-full px-2 py-0.5 text-caption font-medium uppercase tracking-wide transition-colors ${
                              row.status === option
                                ? 'bg-primary text-primary-foreground'
                                : 'border border-border text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
