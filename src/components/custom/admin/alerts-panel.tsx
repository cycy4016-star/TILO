'use client';

// F8 ALERTS: the operator's notification stream and the rules that shape it.
// The left column is the feed (unread rows lit, digests tagged); the right
// column is the live rules editor — every kind gets a cadence (OFF/INSTANT/
// HOURLY/DAILY) and the money kinds get an amount floor. Opening the panel
// marks everything read on a short delay, the way opening a chat clears it.
import { useEffect, useRef, useState } from 'react';
import {
  AlertCadence,
  type AlertCadenceValue,
  type AlertKindValue,
} from '@/lib/contracts/admin-alerts';
import { formatGhs } from '@/lib/contracts/order';
import {
  Empty,
  ErrorState,
  formatStamp,
  LivePill,
  Panel,
  Tag,
  TButton,
  TChip,
  TONE,
} from './terminal/primitives';
import { KIND_SHORT, KIND_TONE, useAdminAlerts } from './use-admin-alerts';

const KIND_ORDER: AlertKindValue[] = [
  'SIGNUP',
  'STORE',
  'ORDER',
  'PAYMENT',
  'INCIDENT',
  'FEEDBACK',
];

const KIND_HINT: Record<AlertKindValue, string> = {
  SIGNUP: 'every new account created',
  STORE: 'every storefront that opens',
  ORDER: 'orders from storefronts and the dashboard',
  PAYMENT: 'Paystack success / failure transitions',
  INCIDENT: 'first sighting of each error fingerprint',
  FEEDBACK: 'typed reports from the feedback form',
};

const CADENCES: AlertCadenceValue[] = ['OFF', 'INSTANT', 'HOURLY', 'DAILY'];

const CADENCE_HINT: Record<AlertCadenceValue, string> = {
  OFF: 'stay silent',
  INSTANT: 'ping the moment it happens',
  HOURLY: 'one digest per closed hour',
  DAILY: 'one digest per closed day',
};

const AUTO_READ_MS = 3_000;

function ThresholdInput({
  value,
  busy,
  onCommit,
  label,
}: {
  value: number | null;
  busy: boolean;
  onCommit: (next: number | null) => void;
  label: string;
}) {
  const [text, setText] = useState(value == null ? '' : (value / 100).toFixed(2));

  useEffect(() => {
    setText(value == null ? '' : (value / 100).toFixed(2));
  }, [value]);

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (value != null) onCommit(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setText(value == null ? '' : (value / 100).toFixed(2));
      return;
    }
    const pesewas = Math.round(parsed * 100);
    if (pesewas !== value) onCommit(pesewas);
  };

  return (
    <span className="flex items-center gap-1">
      <label
        className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--t-faint)]"
        htmlFor={`tlz-floor-${label}`}
      >
        Above GH₵
      </label>
      <input
        id={`tlz-floor-${label}`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
        placeholder="0.00"
        inputMode="decimal"
        className={`w-[72px] border bg-[var(--t-input)] px-2 py-[3px] text-right text-[11px] text-[var(--t-bright)] placeholder:text-[var(--t-faint)] focus:outline-none ${
          busy
            ? 'border-[var(--t-amber-dim)]'
            : 'border-[var(--t-border)] focus:border-[var(--t-amber)]'
        }`}
      />
    </span>
  );
}

export function AlertsPanel() {
  const { feed, markAllRead, savingKind, saveSetting } = useAdminAlerts();
  const autoReadArmed = useRef(false);

  // Opening the panel reads the stream — after a beat, so a firehose of new
  // rows is still glanceable before the unread highlight clears.
  useEffect(() => {
    const unread = feed.data?.unread ?? 0;
    if (unread === 0) {
      autoReadArmed.current = false;
      return;
    }
    if (autoReadArmed.current) return;
    autoReadArmed.current = true;
    const id = window.setTimeout(() => {
      autoReadArmed.current = false;
      markAllRead();
    }, AUTO_READ_MS);
    return () => {
      autoReadArmed.current = false;
      window.clearTimeout(id);
    };
  }, [feed.data?.unread, markAllRead]);

  if (!feed.data) {
    return feed.error ? (
      <Panel code="AL" title="Alert stream">
        <ErrorState message="Could not load the alert stream." onRetry={feed.refresh} />
      </Panel>
    ) : (
      <Panel code="AL" title="Alert stream">
        <p className="animate-pulse py-20 text-center text-[12px] uppercase tracking-[0.2em] text-[var(--t-faint)]">
          Opening the wire…
        </p>
      </Panel>
    );
  }

  const { alerts, unread, settings } = feed.data;

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Panel
        code="AL"
        title="Alert stream"
        bodyClassName="p-0"
        right={
          <span className="flex items-center gap-3">
            <span className={`font-bold ${unread > 0 ? TONE.amber : TONE.dim}`}>
              {unread > 0 ? `${unread} unread` : 'all read'}
            </span>
            <TButton onClick={markAllRead} disabled={unread === 0} tone="amber">
              Mark read
            </TButton>
            <LivePill
              live={feed.live}
              updatedAt={feed.updatedAt}
              onToggle={feed.live ? feed.pause : feed.resume}
              onRefresh={feed.refresh}
            />
          </span>
        }
      >
        {alerts.length === 0 ? (
          <Empty
            title="All quiet"
            hint="Signups, sales, payments, incidents and feedback will land here the moment they happen."
          />
        ) : (
          alerts.map((alert) => {
            const unreadRow = alert.readAt === null;
            const isDigest = alert.windowStart !== null;
            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 border-b border-[var(--t-grid)] px-3 py-2.5 last:border-b-0 ${
                  unreadRow ? 'bg-[var(--t-card-hi)]' : ''
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-[5px] h-[7px] w-[7px] shrink-0 ${
                    unreadRow ? 'bg-[var(--t-amber)]' : 'bg-[var(--t-border)]'
                  }`}
                />
                <span className="w-[92px] shrink-0 pt-[1px] text-[11px] text-[var(--t-faint)]">
                  {formatStamp(alert.createdAt)}
                </span>
                <Tag tone={KIND_TONE[alert.kind]}>{KIND_SHORT[alert.kind]}</Tag>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      className={`min-w-0 truncate text-[12px] font-bold ${
                        unreadRow ? 'text-[var(--t-bright)]' : 'text-[var(--t-text)]'
                      }`}
                    >
                      {alert.title}
                    </span>
                    {alert.count > 1 && (
                      <span className="shrink-0 text-[10px] font-bold text-[var(--t-amber)]">
                        ×{alert.count}
                      </span>
                    )}
                    {isDigest && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--t-cyan)]">
                        digest
                      </span>
                    )}
                    {alert.amountPesewas != null && (
                      <span className="ml-auto shrink-0 text-[11px] font-bold text-[var(--t-green)]">
                        {formatGhs(alert.amountPesewas)}
                      </span>
                    )}
                  </span>
                  {alert.body && (
                    <span className="mt-0.5 block truncate text-[11px] text-[var(--t-dim)]">
                      {alert.body}
                    </span>
                  )}
                </span>
              </div>
            );
          })
        )}
      </Panel>

      <Panel
        code="RU"
        title="Alert rules · what pings you"
        right={<span>applies immediately</span>}
      >
        <div className="flex flex-col">
          {KIND_ORDER.map((kind) => {
            const setting = settings.find((entry) => entry.kind === kind);
            const cadence = setting?.cadence ?? AlertCadence.enum.INSTANT;
            const busy = savingKind === kind;
            return (
              <div
                key={kind}
                className="border-b border-[var(--t-grid)] py-2.5 first:pt-0 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <Tag tone={KIND_TONE[kind]}>{KIND_SHORT[kind]}</Tag>
                  <span className="text-[11px] font-bold tracking-[0.06em] text-[var(--t-text)] uppercase">
                    {kind}
                  </span>
                  <span className="hidden text-[10px] text-[var(--t-faint)] lg:inline">
                    {KIND_HINT[kind]}
                  </span>
                  {busy && (
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--t-amber)]">
                      saving…
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {CADENCES.map((option) => (
                    <TChip
                      key={option}
                      active={cadence === option}
                      onClick={() =>
                        void saveSetting(kind, option, setting?.minAmountPesewas ?? null)
                      }
                    >
                      <span title={CADENCE_HINT[option]}>{option}</span>
                    </TChip>
                  ))}
                  {(kind === 'ORDER' || kind === 'PAYMENT') && (
                    <span className="ml-auto">
                      <ThresholdInput
                        label={kind}
                        busy={busy}
                        value={setting?.minAmountPesewas ?? null}
                        onCommit={(next) => void saveSetting(kind, cadence, next)}
                      />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 border-t border-[var(--t-grid)] pt-2.5 text-[10px] leading-relaxed text-[var(--t-faint)]">
          INSTANT pings as it happens. HOURLY and DAILY roll into one digest when the hour or day
          closes. The GH₵ floor only silences smaller amounts. Everything lands in this stream and
          pops a toast while the terminal is open.
        </p>
      </Panel>
    </div>
  );
}
