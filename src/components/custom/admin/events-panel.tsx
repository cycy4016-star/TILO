// Event stream: a merge of orders, SMS, payments, signups, incidents and
// feedback — the closest thing the app has to a Splunk feed.
'use client';

import { Activity, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';
import { type OpsEvents as Events, type OpsEventKind, OpsEvents } from '@/lib/contracts/admin';
import { formatDate, PanelFallback } from './shared';

const EVENT_KINDS: { value: OpsEventKind | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'order', label: 'Orders' },
  { value: 'sms', label: 'SMS' },
  { value: 'payment', label: 'Payments' },
  { value: 'signup', label: 'Signups' },
  { value: 'error', label: 'Errors' },
  { value: 'feedback', label: 'Feedback' },
];

const EVENT_BADGES: Record<OpsEventKind, string> = {
  order: 'bg-primary/10 text-primary',
  sms: 'bg-muted text-muted-foreground',
  payment: 'bg-primary/10 text-primary',
  signup: 'bg-muted text-foreground',
  store: 'bg-muted text-muted-foreground',
  error: 'bg-destructive/10 text-destructive',
  feedback: 'bg-muted text-foreground',
};

export function EventsPanel() {
  const [events, setEvents] = useState<Events | null>(null);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<OpsEventKind | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (search: string, source: OpsEventKind | '') => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (source) params.set('kind', source);
      const suffix = params.toString();
      setEvents(
        await apiFetch(`/api/admin/events${suffix ? `?${suffix}` : ''}`, { schema: OpsEvents }),
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(query, kind);
  }, [load, query, kind]);

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
            placeholder="Search orders, numbers, shops, errors…"
            aria-label="Search platform events"
            className="h-11 rounded-md border-border bg-card pl-11"
          />
        </div>
        <Button type="submit" variant="outline" className="h-11 rounded-md font-semibold">
          Hunt
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {EVENT_KINDS.map((entry) => (
          <Button
            key={entry.label}
            type="button"
            size="sm"
            onClick={() => setKind(entry.value)}
            className={`h-9 rounded-md px-4 text-small font-medium ${
              kind === entry.value
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
      ) : error || !events ? (
        <PanelFallback
          message="Could not load the event stream."
          onRetry={() => void load(query, kind)}
        />
      ) : events.events.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/40 px-6 py-12 text-center">
          <Activity aria-hidden className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-h4 font-display">Nothing in the stream</p>
          <p className="mx-auto mt-1 max-w-sm text-small text-muted-foreground">
            No events match that hunt yet — loosen the query or pick another source.
          </p>
        </div>
      ) : (
        <ol className="grid gap-2">
          {events.events.map((event) => (
            <li
              key={event.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 sm:p-4"
            >
              <span
                aria-hidden
                className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                  event.ok == null
                    ? 'bg-muted-foreground'
                    : event.ok
                      ? 'bg-primary'
                      : 'bg-destructive'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-medium">{event.summary}</p>
                <p className="mt-0.5 truncate text-caption text-muted-foreground">
                  {[event.shop, event.detail].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-caption font-medium uppercase tracking-wide ${EVENT_BADGES[event.kind]}`}
                >
                  {event.kind}
                </span>
                <span className="text-caption text-muted-foreground">{formatDate(event.ts)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
