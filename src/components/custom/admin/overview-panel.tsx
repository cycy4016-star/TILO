// F1 · OVERVIEW — the platform tape. Headline figures first (the board an
// operator reads from across the room), then the daily series behind them and
// the reliability strip. Live; the window chips re-request with ?days=.
'use client';

import { useState } from 'react';
import { AdminOverview, type AdminOverviewDay } from '@/lib/contracts/admin';
import { formatGhs } from '@/lib/contracts/order';
import {
  Bar,
  Cell,
  DataTable,
  Dot,
  ErrorState,
  formatDay,
  LivePill,
  num,
  Panel,
  Row,
  Spark,
  Stat,
  TChip,
  TONE,
  type Tone,
  Trend,
} from './terminal/primitives';
import { useLiveData } from './use-live';

const RANGES = [7, 14, 30] as const;

const STATUS_TONE: Record<string, Tone> = {
  COMPLETED: 'green',
  PROCESSING: 'amber',
  PENDING: 'cyan',
  CANCELLED: 'red',
  REFUNDED: 'red',
};

function Hero({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: Tone;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-2 border-l border-[var(--t-grid)] px-4 py-3 first:border-l-0">
      <span className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--t-dim)]">
        {label}
      </span>
      <span className={`truncate text-[26px] font-bold leading-none ${TONE[tone]}`}>{value}</span>
      {sub && <span className="truncate text-[11px] text-[var(--t-faint)]">{sub}</span>}
    </div>
  );
}

function DailyTape({ daily, days }: { daily: AdminOverviewDay[]; days: number }) {
  const maxOrders = Math.max(1, ...daily.map((day) => day.orders));
  const maxItems = Math.max(1, ...daily.map((day) => day.items));

  return (
    <DataTable
      columns={[
        { key: 'day', label: `Day · last ${days}` },
        { key: 'orders', label: 'Orders', right: true },
        { key: 'items', label: 'Items', right: true },
        { key: 'signups', label: 'Signups', right: true },
        { key: 'inquiries', label: 'Inq', right: true },
        { key: 'errors', label: 'New bugs', right: true },
        { key: 'orders-tape', label: 'Orders' },
        { key: 'items-tape', label: 'Catalogue' },
      ]}
      empty="No days in this window."
    >
      {daily.map((day) => (
        <Row key={day.day}>
          <Cell tone="dim">{formatDay(day.day)}</Cell>
          <Cell right tone={day.orders > 0 ? 'amber' : 'faint'}>
            {day.orders}
          </Cell>
          <Cell right tone={day.items > 0 ? 'text' : 'faint'}>
            {day.items}
          </Cell>
          <Cell right tone={day.signups > 0 ? 'text' : 'faint'}>
            {day.signups}
          </Cell>
          <Cell right tone={day.inquiries > 0 ? 'cyan' : 'faint'}>
            {day.inquiries}
          </Cell>
          <Cell right tone={day.errors > 0 ? 'red' : 'faint'}>
            {day.errors}
          </Cell>
          <Cell>
            <Bar value={day.orders} max={maxOrders} tone="amber" />
          </Cell>
          <Cell>
            <Bar value={day.items} max={maxItems} tone="cyan" />
          </Cell>
        </Row>
      ))}
    </DataTable>
  );
}

export function OverviewPanel() {
  const [days, setDays] = useState<number>(14);
  const feed = useLiveData(`/api/admin/overview?days=${days}`, AdminOverview);
  const o = feed.data;

  const controls = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--t-faint)]">
          Window
        </span>
        {RANGES.map((range) => (
          <TChip key={range} active={days === range} onClick={() => setDays(range)}>
            {range}D
          </TChip>
        ))}
      </span>
      <LivePill
        live={feed.live}
        updatedAt={feed.updatedAt}
        onToggle={feed.live ? feed.pause : feed.resume}
        onRefresh={feed.refresh}
      />
    </span>
  );

  if (!o) {
    return (
      <Panel code="MKT" title="Platform tape" right={controls}>
        {feed.error ? (
          <ErrorState message="Could not reach the overview feed." onRetry={feed.refresh} />
        ) : (
          <p className="animate-pulse py-20 text-center text-[12px] uppercase tracking-[0.2em] text-[var(--t-faint)]">
            Loading tape…
          </p>
        )}
      </Panel>
    );
  }

  const totalStatuses = Object.values(o.ordersByStatus).reduce((a, b) => a + b, 0);
  const mixMax = Math.max(1, ...Object.values(o.ordersByStatus));
  const collectedShare = o.gmvPesewas > 0 ? Math.round((o.paidPesewas / o.gmvPesewas) * 100) : 0;
  const outstanding = o.gmvPesewas - o.paidPesewas;

  return (
    <div className="grid gap-3">
      <Panel code="MKT" title="Platform tape" right={controls}>
        <div className="grid grid-cols-2 border-b border-[var(--t-grid)] sm:grid-cols-3 xl:grid-cols-6">
          <Hero
            label="Volume moved"
            value={formatGhs(o.gmvPesewas)}
            tone="amber"
            sub={`${days} day window`}
          />
          <Hero
            label="Collected"
            value={formatGhs(o.paidPesewas)}
            tone="green"
            sub={`${collectedShare}% of volume`}
          />
          <Hero
            label="Outstanding"
            value={formatGhs(outstanding)}
            tone={outstanding > 0 ? 'red' : 'dim'}
            sub={`${o.unpaidOrders} unpaid orders`}
          />
          <Hero label="Orders" value={num(o.orders)} tone="text" sub={`${o.ordersToday} today`} />
          <Hero
            label="Shops live"
            value={`${o.activeStores}/${o.stores}`}
            tone="green"
            sub={`${o.items} items listed`}
          />
          <Hero
            label="Customers"
            value={num(o.customers)}
            tone="text"
            sub={`${o.leads} leads on file`}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          <Stat label="Accounts" value={num(o.users)} sub={`+${o.signupsMonth} this month`} />
          <Stat
            label="Sign-ins today"
            value={num(o.signInsToday)}
            sub={`+${o.signInsMonth} this month`}
            tone="cyan"
          />
          <Stat label="Catalogue" value={num(o.items)} sub={`+${o.itemsAddedMonth} this month`} />
          <Stat label="Leads" value={num(o.leads)} sub={`+${o.leadsMonth} this month`} />
          <Stat label="Inquiries" value={num(o.inquiries)} sub="all-time submissions" />
          <Stat
            label="Open incidents"
            value={num(o.errorsOpen)}
            sub={`${o.errorOccurrences} occurrences`}
            tone={o.errorsOpen > 0 ? 'red' : 'green'}
          />
          <Stat
            label="Feedback"
            value={`${o.feedbackNew}/${o.feedbackTotal}`}
            sub={o.feedbackNew > 0 ? 'untriaged' : 'all triaged'}
            tone={o.feedbackNew > 0 ? 'amber' : 'green'}
          />
        </div>
      </Panel>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <Panel
          code="SER"
          title={`Daily series · last ${days} days`}
          right={
            <span className="flex items-center gap-3">
              <span>
                ORDERS <Spark values={o.daily.map((day) => day.orders)} tone="amber" />
              </span>
              <span>
                ITEMS <Spark values={o.daily.map((day) => day.items)} tone="cyan" />
              </span>
            </span>
          }
          bodyClassName="p-0"
        >
          <div className="grid grid-cols-1 gap-x-4 border-b border-[var(--t-grid)] px-3 pt-2.5 sm:grid-cols-3">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--t-dim)]">
                Orders
              </span>
              <Trend
                values={o.daily.map((day) => day.orders)}
                tone="amber"
                title="Orders per day"
              />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--t-dim)]">
                Items added
              </span>
              <Trend values={o.daily.map((day) => day.items)} tone="cyan" title="Items per day" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--t-dim)]">
                Signups
              </span>
              <Trend
                values={o.daily.map((day) => day.signups)}
                tone="green"
                title="Signups per day"
              />
            </div>
          </div>
          <DailyTape daily={o.daily} days={days} />
        </Panel>

        <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <Panel code="MIX" title="Order mix" right={<span>{num(totalStatuses)} orders</span>}>
            {totalStatuses === 0 ? (
              <p className="py-8 text-center text-[12px] text-[var(--t-faint)]">
                No orders yet — the mix fills in as shops transact.
              </p>
            ) : (
              <ul className="grid gap-2.5">
                {Object.entries(o.ordersByStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <li key={status} className="grid gap-1.5">
                      <span className="flex items-baseline justify-between gap-3 text-[12px]">
                        <span
                          className={`font-bold uppercase tracking-[0.08em] ${
                            STATUS_TONE[status] ? TONE[STATUS_TONE[status]] : TONE.dim
                          }`}
                        >
                          {status}
                        </span>
                        <span className="font-bold">
                          {num(count)}
                          <span className="ml-1.5 text-[11px] font-normal text-[var(--t-faint)]">
                            {Math.round((count / totalStatuses) * 100)}%
                          </span>
                        </span>
                      </span>
                      <Bar value={count} max={mixMax} tone={STATUS_TONE[status] ?? 'dim'} />
                    </li>
                  ))}
              </ul>
            )}
          </Panel>

          <Panel code="REL" title="Reliability">
            <ul className="grid">
              <li className="flex items-center justify-between gap-3 border-b border-dashed border-[var(--t-grid)] py-2 text-[12px] last:border-b-0">
                <span className="flex items-center gap-2 text-[var(--t-dim)]">
                  <Dot tone={o.errorsOpen > 0 ? 'red' : 'green'} />
                  Incidents open
                </span>
                <span className="font-bold">
                  <span className={o.errorsOpen > 0 ? TONE.red : TONE.green}>
                    {num(o.errorsOpen)}
                  </span>
                  <span className="ml-1.5 text-[11px] font-normal text-[var(--t-faint)]">
                    / {num(o.errorOccurrences)} logged
                  </span>
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 border-b border-dashed border-[var(--t-grid)] py-2 text-[12px] last:border-b-0">
                <span className="text-[var(--t-dim)]">Feedback untriaged</span>
                <span className="font-bold">
                  <span className={o.feedbackNew > 0 ? TONE.amber : TONE.green}>
                    {num(o.feedbackNew)}
                  </span>
                  <span className="ml-1.5 text-[11px] font-normal text-[var(--t-faint)]">
                    / {num(o.feedbackTotal)}
                  </span>
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 border-b border-dashed border-[var(--t-grid)] py-2 text-[12px] last:border-b-0">
                <span className="text-[var(--t-dim)]">SMS month</span>
                <span className="font-bold">
                  <span className={TONE.green}>{num(o.smsSentMonth)}</span>
                  <span className="mx-1 text-[11px] font-normal text-[var(--t-faint)]">sent</span>
                  <span className={o.smsFailedMonth > 0 ? TONE.red : TONE.dim}>
                    {num(o.smsFailedMonth)}
                  </span>
                  <span className="ml-1.5 text-[11px] font-normal text-[var(--t-faint)]">
                    failed · {num(o.smsCreditsMonth)} cr
                  </span>
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 py-2 text-[12px]">
                <span className="text-[var(--t-dim)]">Paystack</span>
                <span className="font-bold">
                  <span className={TONE.green}>{num(o.paymentsSuccess)}</span>
                  <span className="mx-1 text-[11px] font-normal text-[var(--t-faint)]">
                    settled
                  </span>
                  <span className={o.paymentsPending > 0 ? TONE.amber : TONE.dim}>
                    {num(o.paymentsPending)}
                  </span>
                  <span className="mx-1 text-[11px] font-normal text-[var(--t-faint)]">pend</span>
                  <span className={o.paymentsFailed > 0 ? TONE.red : TONE.dim}>
                    {num(o.paymentsFailed)}
                  </span>
                  <span className="ml-1.5 text-[11px] font-normal text-[var(--t-faint)]">fail</span>
                </span>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
