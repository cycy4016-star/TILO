// F5 · EVENTS — a merge of orders, SMS, payments, signups, sign-ins, shop
// openings, lead captures, incidents and feedback into one tape: the closest
// thing the platform has to a Splunk feed. Live, so a new event surfaces on
// its own.
'use client';

import { useState } from 'react';
import { type OpsEventKind, OpsEvents as OpsEventsSchema } from '@/lib/contracts/admin';
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
  TChip,
  TONE,
  type Tone,
} from './terminal/primitives';
import { useLiveData } from './use-live';

const EVENT_KINDS: { value: OpsEventKind | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'order', label: 'Orders' },
  { value: 'sms', label: 'SMS' },
  { value: 'payment', label: 'Payments' },
  { value: 'signup', label: 'Signups' },
  { value: 'signin', label: 'Sign-ins' },
  { value: 'lead', label: 'Leads' },
  { value: 'store', label: 'Shops' },
  { value: 'error', label: 'Errors' },
  { value: 'feedback', label: 'Feedback' },
];

const KIND_TONE: Record<OpsEventKind, Tone> = {
  order: 'amber',
  sms: 'dim',
  payment: 'green',
  signup: 'cyan',
  signin: 'green',
  lead: 'cyan',
  store: 'dim',
  error: 'red',
  feedback: 'text',
};

export function EventsPanel() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<OpsEventKind | ''>('');

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (kind) params.set('kind', kind);
  const suffix = params.toString();
  const feed = useLiveData(`/api/admin/events${suffix ? `?${suffix}` : ''}`, OpsEventsSchema);
  const events = feed.data;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-[var(--t-border)] bg-[var(--t-card)] px-3 py-2">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <SearchField
            label="Search events"
            value={input}
            onChange={setInput}
            onSubmit={() => setQuery(input.trim())}
            placeholder="orders · numbers · shops · errors"
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
          Source
        </span>
        {EVENT_KINDS.map((entry) => (
          <TChip
            key={entry.label}
            active={kind === entry.value}
            onClick={() => setKind(entry.value)}
          >
            {entry.label}
          </TChip>
        ))}
      </div>

      {!events ? (
        feed.error ? (
          <Panel code="EV" title="Event tape">
            <ErrorState message="Could not load the event stream." onRetry={feed.refresh} />
          </Panel>
        ) : (
          <Panel code="EV" title="Event tape">
            <p className="animate-pulse py-20 text-center text-[12px] uppercase tracking-[0.2em] text-[var(--t-faint)]">
              Listening…
            </p>
          </Panel>
        )
      ) : (
        <Panel
          code="EV"
          title="Event tape"
          right={
            <span>
              {events.events.length}/{events.total} events{query ? ` matching “${query}”` : ''}
            </span>
          }
          bodyClassName="p-0"
        >
          {events.events.length === 0 ? (
            <Empty
              title="Nothing in the stream"
              hint="No events match that hunt — loosen the query or pick another source."
            />
          ) : (
            <DataTable
              columns={[
                { key: 'time', label: 'Time' },
                { key: 'kind', label: 'Kind' },
                { key: 'shop', label: 'Shop' },
                { key: 'summary', label: 'Event' },
                { key: 'detail', label: 'Detail' },
                { key: 'result', label: 'Result', right: true },
              ]}
            >
              {events.events.map((event) => (
                <Row key={event.id}>
                  <Cell tone="dim">{formatStamp(event.ts)}</Cell>
                  <Cell tone={KIND_TONE[event.kind]}>
                    <span className="font-bold uppercase">{event.kind}</span>
                  </Cell>
                  <Cell tone="cyan">{event.shop ?? '—'}</Cell>
                  <Cell tone="text">{event.summary}</Cell>
                  <Cell tone="faint">{event.detail ?? '—'}</Cell>
                  <Cell right>
                    {event.ok == null ? (
                      <span className={TONE.faint}>—</span>
                    ) : event.ok ? (
                      <span className={TONE.green}>OK</span>
                    ) : (
                      <span className={TONE.red}>FAIL</span>
                    )}
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </Panel>
      )}
    </div>
  );
}
