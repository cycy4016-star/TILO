// Platform overview: cross-shop totals + 14-day activity bars.
'use client';

import {
  Inbox,
  MessageSquareText,
  ShieldAlert,
  ShoppingCart,
  Store as StoreIcon,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { AdminOverview, type AdminOverview as Overview } from '@/lib/contracts/admin';
import { formatGhs } from '@/lib/contracts/order';
import { formatDay, PanelFallback, StatCard } from './shared';

export function OverviewPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await apiFetch('/api/admin/overview', { schema: AdminOverview }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />;
  }
  if (error || !data) {
    return (
      <PanelFallback message="Could not load the platform overview." onRetry={() => void load()} />
    );
  }

  const peak = Math.max(1, ...data.daily.flatMap((day) => [day.signups, day.orders]));
  const growthPeak = Math.max(
    1,
    ...data.daily.flatMap((day) => [day.items, day.inquiries, day.errors]),
  );
  const statusEntries = Object.entries(data.ordersByStatus);

  return (
    <div className="grid gap-4 sm:gap-6">
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Accounts"
          value={String(data.users)}
          sub={`+${data.signupsMonth} this month`}
        />
        <StatCard
          icon={StoreIcon}
          label="Shops live"
          value={`${data.activeStores}/${data.stores}`}
          sub={`${data.items} items listed · +${data.itemsAddedMonth} this month`}
        />
        <StatCard
          icon={ShoppingCart}
          label="Orders"
          value={String(data.orders)}
          sub={`${data.ordersToday} today · ${data.unpaidOrders} unpaid`}
        />
        <StatCard
          icon={Wallet}
          label="Volume moved"
          value={formatGhs(data.gmvPesewas)}
          sub={`${formatGhs(data.paidPesewas)} collected`}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={UserPlus}
          label="Leads"
          value={String(data.leads)}
          sub={`${data.leadsMonth} new this month`}
        />
        <StatCard
          icon={Inbox}
          label="Inquiries"
          value={String(data.inquiries)}
          sub="lead-form submissions, repeats included"
        />
        <StatCard
          icon={ShieldAlert}
          label="Open incidents"
          value={String(data.errorsOpen)}
          sub={`${data.errorOccurrences} occurrences logged`}
        />
        <StatCard
          icon={MessageSquareText}
          label="Feedback"
          value={`${data.feedbackNew}/${data.feedbackTotal}`}
          sub="awaiting triage"
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h4 font-display">Last 14 days</h2>
          <p className="flex items-center gap-3 text-caption text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className="size-2 rounded-full bg-primary" /> Signups
            </span>
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className="size-2 rounded-full bg-muted-foreground" /> Orders
            </span>
          </p>
        </div>
        <div className="mt-4 flex h-36 items-end gap-1 sm:h-44 sm:gap-2">
          {data.daily.map((day) => (
            <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-28 w-full items-end justify-center gap-0.5 sm:h-36">
                <span
                  title={`${day.signups} signups`}
                  className="w-full max-w-3 rounded-sm bg-primary"
                  style={{
                    height: `${Math.max(day.signups > 0 ? 4 : 0, (day.signups / peak) * 100)}%`,
                  }}
                />
                <span
                  title={`${day.orders} orders`}
                  className="w-full max-w-3 rounded-sm bg-muted-foreground/50"
                  style={{
                    height: `${Math.max(day.orders > 0 ? 4 : 0, (day.orders / peak) * 100)}%`,
                  }}
                />
              </div>
              <span className="hidden text-caption text-muted-foreground min-[420px]:block">
                {formatDay(day.day)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h4 font-display">Items, inquiries &amp; incidents</h2>
          <p className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className="size-2 rounded-sm bg-primary" /> Items added
            </span>
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className="size-2 rounded-sm bg-muted-foreground" /> Inquiries
            </span>
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className="size-2 rounded-sm bg-destructive" /> New incidents
            </span>
          </p>
        </div>
        <div className="mt-4 flex h-36 items-end gap-1 sm:h-44 sm:gap-2">
          {data.daily.map((day) => (
            <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-28 w-full items-end justify-center gap-0.5 sm:h-36">
                <span
                  title={`${day.items} items added`}
                  className="w-full max-w-3 rounded-sm bg-primary"
                  style={{
                    height: `${Math.max(day.items > 0 ? 4 : 0, (day.items / growthPeak) * 100)}%`,
                  }}
                />
                <span
                  title={`${day.inquiries} inquiries`}
                  className="w-full max-w-3 rounded-sm bg-muted-foreground"
                  style={{
                    height: `${Math.max(
                      day.inquiries > 0 ? 4 : 0,
                      (day.inquiries / growthPeak) * 100,
                    )}%`,
                  }}
                />
                <span
                  title={`${day.errors} new incidents`}
                  className="w-full max-w-3 rounded-sm bg-destructive"
                  style={{
                    height: `${Math.max(day.errors > 0 ? 4 : 0, (day.errors / growthPeak) * 100)}%`,
                  }}
                />
              </div>
              <span className="hidden text-caption text-muted-foreground min-[420px]:block">
                {formatDay(day.day)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-caption text-muted-foreground">
          Incidents are grouped, so a bar counts bugs first seen that day — repeats land in the
          occurrence total above.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-h4 font-display">Order mix</h2>
          <ul className="mt-3 grid gap-2">
            {statusEntries.length === 0 && (
              <li className="text-small text-muted-foreground">No orders yet.</li>
            )}
            {statusEntries.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between gap-3 text-small">
                <span className="font-medium">{status}</span>
                <span className="font-mono font-semibold">{count}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-h4 font-display">SMS this month</h2>
          <p className="mt-3 font-display text-h3 text-foreground">
            {data.smsCreditsMonth} credits
          </p>
          <p className="mt-1 text-small text-muted-foreground">
            {data.smsSentMonth} delivered · {data.smsFailedMonth} failed
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-h4 font-display">Paystack</h2>
          <p className="mt-3 font-display text-h3 text-foreground">
            {data.paymentsSuccess} settled
          </p>
          <p className="mt-1 text-small text-muted-foreground">
            {data.paymentsPending} pending · {data.paymentsFailed} failed/abandoned
          </p>
        </article>
      </section>
    </div>
  );
}
