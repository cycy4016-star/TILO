// The owner's Intelligence island: the business balance sheet in one screen —
// money lanes, shelf economics, realized margins, and the biggest earners.
'use client';

import { ArrowRight, BrainCircuit, Coins, Package, Scale, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import {
  DashboardIntelligence,
  type DashboardIntelligence as Intelligence,
} from '@/lib/contracts/intelligence';
import { formatGhs } from '@/lib/contracts/order';

export function IntelligenceWorkspace() {
  const [data, setData] = useState<Intelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/dashboard/intelligence', { schema: DashboardIntelligence })
      .then((result) => {
        if (!cancelled) setData(result);
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
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-[1.75rem] border-2 border-amber-950 bg-white dark:bg-stone-900"
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-[1.75rem] border-2 border-amber-950 bg-white p-6 dark:bg-stone-900">
        <p className="font-bold text-amber-700">The ledger would not open — try again.</p>
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-950 via-[#78350f] to-yellow-600 p-8 text-amber-50 sm:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(circle at 80% 15%, #facc15 0, transparent 35%), radial-gradient(circle at 15% 90%, #fcd34d 0, transparent 30%)',
          }}
        />
        <div className="relative flex flex-wrap items-center gap-3">
          <span className="inline-flex -rotate-2 items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.18em] text-amber-950">
            <BrainCircuit aria-hidden className="size-3.5" /> Intelligence
          </span>
          <span className="inline-flex rotate-1 items-center gap-1.5 rounded-full border-2 border-amber-50/40 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.18em]">
            <Scale aria-hidden className="size-3.5" /> The balance sheet
          </span>
        </div>
        <h1 className="relative mt-5 font-display text-4xl font-black uppercase leading-none sm:text-5xl">
          Know your <span className="text-amber-300">numbers.</span>
        </h1>
        <p className="relative mt-3 max-w-md font-medium text-amber-100">
          What you&apos;re owed, what the shelf is worth, and what actually earns.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-[1.75rem] border-2 border-amber-950 bg-white p-6 shadow-[5px_5px_0_0_#451a03] dark:bg-stone-900">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-yellow-600 text-white">
            <Coins aria-hidden className="size-5" />
          </span>
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-stone-500">
            Money in (month)
          </p>
          <p className="mt-1 font-display text-3xl font-black uppercase leading-none text-amber-950 dark:text-amber-50">
            {formatGhs(data.moneyInMonthPesewas)}
          </p>
          <p className="mt-2 text-sm font-medium text-stone-500">
            {data.moneyInMonthCount} paid {data.moneyInMonthCount === 1 ? 'order' : 'orders'}
          </p>
        </article>
        <article className="-rotate-1 rounded-[1.75rem] border-2 border-amber-950 bg-white p-6 shadow-[5px_5px_0_0_#451a03] dark:bg-stone-900">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-amber-500 text-white">
            <TrendingUp aria-hidden className="size-5" />
          </span>
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-stone-500">
            Money on the chase
          </p>
          <p className="mt-1 font-display text-3xl font-black uppercase leading-none text-amber-950 dark:text-amber-50">
            {formatGhs(data.outstandingPesewas)}
          </p>
          <p className="mt-2 text-sm font-medium text-stone-500">
            {data.outstandingCount} open {data.outstandingCount === 1 ? 'order' : 'orders'}
          </p>
        </article>
        <article className="rotate-1 rounded-[1.75rem] border-2 border-amber-950 bg-white p-6 shadow-[5px_5px_0_0_#451a03] dark:bg-stone-900">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Package aria-hidden className="size-5" />
          </span>
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-stone-500">
            Shelf worth at retail
          </p>
          <p className="mt-1 font-display text-3xl font-black uppercase leading-none text-amber-950 dark:text-amber-50">
            {formatGhs(data.catalogSellPesewas)}
          </p>
          <p className="mt-2 text-sm font-medium text-stone-500">
            {data.catalogItemCount} live {data.catalogItemCount === 1 ? 'item' : 'items'}
          </p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <article className="rounded-[2rem] border-2 border-amber-950 bg-[#fffbeb] p-6 dark:bg-stone-900 sm:p-7">
          <h2 className="flex items-center gap-2 font-display text-xl font-black uppercase">
            <Scale aria-hidden className="size-5 text-yellow-600" /> Shelf economics
          </h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-stone-600 dark:text-stone-300">
                What it sells for
              </span>
              <span className="font-mono text-sm font-black">
                {formatGhs(data.catalogSellPesewas)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-stone-600 dark:text-stone-300">
                What it costs to hold
              </span>
              <span className="font-mono text-sm font-black">
                {formatGhs(data.catalogCostPesewas)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-stone-600 dark:text-stone-300">
                Potential profit
              </span>
              <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
                {formatGhs(data.catalogProfitPesewas)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-stone-600 dark:text-stone-300">
                Margin at retail
              </span>
              <span className="font-mono text-sm font-black">{data.catalogMarginPercent}%</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-stone-600 dark:text-stone-300">
                Items missing a cost price
              </span>
              <span className="font-mono text-sm font-black text-amber-700 dark:text-amber-400">
                {data.itemsMissingCost}
              </span>
            </div>
          </div>
          {data.itemsMissingCost > 0 && (
            <div className="mt-5 rounded-[1.25rem] border-2 border-dashed border-amber-400 px-4 py-3 text-xs font-medium text-stone-600 dark:text-stone-300">
              {data.itemsMissingCost} {data.itemsMissingCost === 1 ? 'item has' : 'items have'} no
              cost price, {data.itemsMissingCost === 1 ? 'so it' : 'so they'} can&apos;t count its
              margin. Add cost prices on the store shelf to sharpen these numbers.
            </div>
          )}
          <div className="pt-4">
            <Button
              asChild
              variant="link"
              className="h-auto p-0 font-black uppercase tracking-wide text-amber-700 dark:text-amber-300"
            >
              <Link href="/dashboard/store">
                Open the shelf <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </div>
        </article>

        <article className="-rotate-1 rounded-[2rem] bg-amber-950 p-6 text-amber-50 sm:p-7">
          <h2 className="flex items-center gap-2 font-display text-xl font-black uppercase text-amber-300">
            <TrendingUp aria-hidden className="size-5" /> Realized margins
          </h2>
          <p className="mt-1 text-sm font-medium text-amber-200">
            From actual sold orders, once costs are taken out.
          </p>
          <p className="mt-5 font-display text-4xl font-black uppercase leading-none text-amber-50">
            {formatGhs(data.realizedProfitPesewas)}
          </p>
          <p className="mt-2 text-sm font-bold text-amber-100">
            {data.realizedRevenuePesewas > 0
              ? `${data.realizedMarginPercent}% margin on ${data.realizedUnitCount} sold ${data.realizedUnitCount === 1 ? 'unit' : 'units'}`
              : 'No productized sales yet'}
          </p>
          <p className="mt-5 text-xs font-medium leading-relaxed text-amber-200/80">
            {formatGhs(data.realizedRevenuePesewas)} sold, {formatGhs(data.realizedCogsPesewas)} in
            cost, across {data.realizedOrderCount} orders. Sell through the storefront or add line
            items to orders and this lane comes alive.
          </p>
        </article>
      </section>

      <section
        id="biggest-earners"
        className="scroll-mt-24 rounded-[2rem] border-2 border-amber-950 bg-[#fffbeb] p-6 dark:bg-stone-900 sm:p-7"
      >
        <h2 className="flex items-center gap-2 font-display text-xl font-black uppercase">
          <Package aria-hidden className="size-5 text-yellow-600" /> Biggest earners
        </h2>
        {data.topItems.length === 0 ? (
          <div className="mt-4 rounded-[1.5rem] border-2 border-dashed border-amber-400 px-5 py-8 text-center">
            <p className="font-display text-lg font-black uppercase">Still quiet</p>
            <p className="mt-1 text-sm font-medium text-stone-500">
              Products with sold line items will line up here by profit.
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-amber-200 dark:divide-stone-800">
            {data.topItems.map((item) => (
              <div key={item.name} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-black uppercase">{item.name}</p>
                  <p className="mt-0.5 text-xs font-medium text-stone-500">
                    {item.unitCount} sold · {formatGhs(item.revenuePesewas)} at{' '}
                    {item.marginPercent != null ? `${item.marginPercent}% margin` : 'no cost set'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wider text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {formatGhs(item.profitPesewas)} earned
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
