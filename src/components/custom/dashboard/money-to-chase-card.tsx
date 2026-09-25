// "Money to chase" — the dashboard card that answers the owner's daily fear:
// how much cash is still sitting out there in unfinished orders?
'use client';

import { ArrowRight, MessagesSquare, Swords, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { DashboardOverview, type DashboardOverview as Overview } from '@/lib/contracts/dashboard';
import { formatGhs } from '@/lib/contracts/order';
import { waMeLink } from '@/lib/phone';

const statusLabels: Record<Overview['topChases'][number]['status'], string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export function MoneyToChaseCard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/dashboard/overview', { schema: DashboardOverview })
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border border-border bg-card dark:bg-stone-900"
          />
        ))}
      </section>
    );
  }

  if (error || !overview) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 dark:bg-stone-900">
        <p className="font-semibold text-foreground">Couldn&apos;t load finances — try again.</p>
      </section>
    );
  }

  const empty = overview.outstandingCount === 0;

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,0.75fr)]">
      <article className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm dark:bg-stone-900 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary">
            <Swords aria-hidden className="size-3.5" /> Money to chase
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white">
            <Wallet aria-hidden className="size-3.5" />
            {formatGhs(overview.recoveredMonthPesewas)} in this month
          </span>
        </div>

        {empty ? (
          <div className="mt-6 rounded-lg border border-dashed border-border px-5 py-8 text-center">
            <p className="text-xl font-bold">All cleared</p>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              No outstanding payments right now.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-5 min-w-0 text-[clamp(2.25rem,9vw,3.75rem)] font-bold leading-none tracking-tight text-foreground">
              {formatGhs(overview.outstandingPesewas)}
            </p>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              outstanding across {overview.outstandingCount} open{' '}
              {overview.outstandingCount === 1 ? 'order' : 'orders'}
              {overview.oldestOutstandingDays != null &&
                ` — oldest waiting ${overview.oldestOutstandingDays} day${overview.oldestOutstandingDays === 1 ? '' : 's'}`}
            </p>
          </>
        )}

        <div className="mt-6 divide-y divide-border">
          {overview.topChases.map((chase) => {
            const chat = waMeLink(chase.customerPhone);
            return (
              <div key={chase.orderId} className="flex items-center gap-3 py-3">
                <Link
                  href={`/dashboard/customers/${chase.customerId}`}
                  className="group min-w-0 flex-1"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate font-bold">{chase.customerName}</span>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-primary">
                      {statusLabels[chase.status]}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-muted-foreground">
                    {chase.orderNumber} · {chase.ageDays}d old
                  </span>
                </Link>
                <span className="shrink-0 font-mono text-sm font-bold text-foreground">
                  {formatGhs(chase.amountPesewas)}
                </span>
                {chat && (
                  <a
                    href={chat}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`WhatsApp ${chase.customerName}`}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
                  >
                    <MessagesSquare aria-hidden className="size-4" />
                  </a>
                )}
              </div>
            );
          })}
          <div className="pt-3">
            <Button asChild variant="link" className="h-auto p-0 font-semibold text-primary">
              <Link href="/dashboard/customers">
                See everyone <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </article>

      <article className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-50 to-teal-100/60 p-6 sm:p-7 dark:from-emerald-950/50 dark:to-teal-950/50">
        <h2 className="flex items-center gap-2 text-xl font-bold text-emerald-700 dark:text-emerald-300">
          <Wallet aria-hidden className="size-5" /> Collected
        </h2>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Cash that landed this month.
        </p>
        <p className="mt-5 text-4xl font-bold leading-none tracking-tight text-foreground">
          {formatGhs(overview.recoveredMonthPesewas)}
        </p>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">
          {overview.recoveredMonthCount} paid{' '}
          {overview.recoveredMonthCount === 1 ? 'order' : 'orders'}
        </p>
        <p className="mt-5 text-xs font-medium leading-relaxed text-muted-foreground">
          Every mark-paid and every follow-up that lands adds to this lane.
        </p>
      </article>
    </section>
  );
}
