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
  PENDING: 'Warming up',
  PROCESSING: 'On the fire',
  COMPLETED: 'Served',
  CANCELLED: 'Rained off',
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
            className="h-40 animate-pulse rounded-[1.75rem] border-2 border-amber-950 bg-white dark:bg-stone-900"
          />
        ))}
      </section>
    );
  }

  if (error || !overview) {
    return (
      <section className="rounded-[1.75rem] border-2 border-amber-950 bg-white p-6 dark:bg-stone-900">
        <p className="font-bold text-amber-700">The till would not open — try again.</p>
      </section>
    );
  }

  const empty = overview.outstandingCount === 0;

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,0.75fr)]">
      <article className="relative overflow-hidden rounded-[2rem] border-2 border-amber-950 bg-[#fffbeb] p-6 shadow-[5px_5px_0_0_#451a03] dark:bg-stone-900 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-950 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.18em] text-amber-300">
            <Swords aria-hidden className="size-3.5" /> Money to chase
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.18em] text-white">
            <Wallet aria-hidden className="size-3.5" />
            {formatGhs(overview.recoveredMonthPesewas)} in this month
          </span>
        </div>

        {empty ? (
          <div className="mt-6 rounded-[1.5rem] border-2 border-dashed border-amber-400 px-5 py-8 text-center">
            <p className="font-display text-xl font-black uppercase">Till is calm</p>
            <p className="mt-1 text-sm font-medium text-stone-500">
              No unfinished money right now. Everything&apos;s collected.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-5 font-display text-5xl font-black uppercase leading-none text-amber-950 dark:text-amber-50 sm:text-6xl">
              {formatGhs(overview.outstandingPesewas)}
            </p>
            <p className="mt-2 text-sm font-bold text-stone-600 dark:text-stone-300">
              outstanding across {overview.outstandingCount} open{' '}
              {overview.outstandingCount === 1 ? 'order' : 'orders'}
              {overview.oldestOutstandingDays != null &&
                ` — oldest waiting ${overview.oldestOutstandingDays} day${overview.oldestOutstandingDays === 1 ? '' : 's'}`}
            </p>
          </>
        )}

        <div className="mt-6 divide-y divide-amber-200 dark:divide-stone-800">
          {overview.topChases.map((chase) => {
            const chat = waMeLink(chase.customerPhone);
            return (
              <div key={chase.orderId} className="flex items-center gap-3 py-3">
                <Link
                  href={`/dashboard/customers/${chase.customerId}`}
                  className="group min-w-0 flex-1"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate font-display text-sm font-black uppercase">
                      {chase.customerName}
                    </span>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wider text-amber-800 dark:bg-stone-800 dark:text-amber-300">
                      {statusLabels[chase.status]}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-stone-500">
                    {chase.orderNumber} · {chase.ageDays}d old
                  </span>
                </Link>
                <span className="shrink-0 font-mono text-sm font-black text-amber-950 dark:text-amber-50">
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
            <Button
              asChild
              variant="link"
              className="h-auto p-0 font-black uppercase tracking-wide text-amber-700 dark:text-amber-300"
            >
              <Link href="/dashboard/customers">
                See everyone <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </article>

      <article className="-rotate-1 rounded-[2rem] bg-amber-950 p-6 text-amber-50 sm:p-7">
        <h2 className="flex items-center gap-2 font-display text-xl font-black uppercase text-amber-300">
          <Wallet aria-hidden className="size-5" /> Collected
        </h2>
        <p className="mt-1 text-sm font-medium text-amber-200">Cash that landed this month.</p>
        <p className="mt-5 font-display text-4xl font-black uppercase leading-none text-amber-50">
          {formatGhs(overview.recoveredMonthPesewas)}
        </p>
        <p className="mt-2 text-sm font-bold text-amber-100">
          {overview.recoveredMonthCount} paid{' '}
          {overview.recoveredMonthCount === 1 ? 'order' : 'orders'}
        </p>
        <p className="mt-5 text-xs font-medium leading-relaxed text-amber-200/80">
          Every mark-paid, every chaser that lands — it all adds to this. Watch this lane grow week
          to week.
        </p>
      </article>
    </section>
  );
}
