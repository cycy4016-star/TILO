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
          <div key={i} className="h-44 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <p className="text-sm font-semibold text-destructive">
          We could not load your summary. Please try again.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-widest text-primary">
            <BrainCircuit aria-hidden className="size-3.5" /> Intelligence
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground">
            <Scale aria-hidden className="size-3.5" /> The balance sheet
          </span>
        </div>
        <h1 className="mt-5 text-3xl font-bold">Know your numbers.</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          What you&apos;re owed, what the catalogue is worth, and what actually earns.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Coins aria-hidden className="size-5" />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Money in (month)
          </p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {formatGhs(data.moneyInMonthPesewas)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.moneyInMonthCount} paid {data.moneyInMonthCount === 1 ? 'order' : 'orders'}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TrendingUp aria-hidden className="size-5" />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Outstanding balance
          </p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {formatGhs(data.outstandingPesewas)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.outstandingCount} open {data.outstandingCount === 1 ? 'order' : 'orders'}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Package aria-hidden className="size-5" />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Catalogue value at retail
          </p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {formatGhs(data.catalogSellPesewas)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.catalogItemCount} live {data.catalogItemCount === 1 ? 'item' : 'items'}
          </p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <article className="rounded-xl border border-border bg-card p-6 sm:p-7">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Scale aria-hidden className="size-5 text-primary" /> Catalogue economics
          </h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">What it sells for</span>
              <span className="font-mono text-sm font-semibold">
                {formatGhs(data.catalogSellPesewas)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">What it costs to hold</span>
              <span className="font-mono text-sm font-semibold">
                {formatGhs(data.catalogCostPesewas)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Potential profit</span>
              <span className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatGhs(data.catalogProfitPesewas)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Margin at retail</span>
              <span className="font-mono text-sm font-semibold">{data.catalogMarginPercent}%</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Items missing a cost price</span>
              <span className="font-mono text-sm font-semibold">{data.itemsMissingCost}</span>
            </div>
          </div>
          {data.itemsMissingCost > 0 && (
            <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              {data.itemsMissingCost} {data.itemsMissingCost === 1 ? 'item has' : 'items have'} no
              cost price, {data.itemsMissingCost === 1 ? 'so it' : 'so they'} can&apos;t count its
              margin. Add cost prices in your catalogue to sharpen these numbers.
            </div>
          )}
          <div className="pt-4">
            <Button asChild variant="link" className="h-auto p-0 font-semibold text-primary">
              <Link href="/dashboard/store">
                Open catalogue <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-card p-6 sm:p-7">
          <h2 className="flex items-center gap-2 text-xl font-bold text-primary">
            <TrendingUp aria-hidden className="size-5" /> Realized margins
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            From actual sold orders, once costs are taken out.
          </p>
          <p className="mt-5 text-4xl font-bold text-foreground">
            {formatGhs(data.realizedProfitPesewas)}
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {data.realizedRevenuePesewas > 0
              ? `${data.realizedMarginPercent}% margin on ${data.realizedUnitCount} sold ${data.realizedUnitCount === 1 ? 'unit' : 'units'}`
              : 'No productized sales yet'}
          </p>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            {formatGhs(data.realizedRevenuePesewas)} sold, {formatGhs(data.realizedCogsPesewas)} in
            cost, across {data.realizedOrderCount} orders. Sell through the storefront or add line
            items to orders and this figure updates automatically.
          </p>
        </article>
      </section>

      <section
        id="biggest-earners"
        className="scroll-mt-24 rounded-xl border border-border bg-card p-6 sm:p-7"
      >
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Package aria-hidden className="size-5 text-primary" /> Biggest earners
        </h2>
        {data.topItems.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border px-5 py-8 text-center">
            <p className="text-lg font-semibold">No ranked items yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Products with sold line items will line up here by profit.
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border">
            {data.topItems.map((item) => (
              <div key={item.name} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.unitCount} sold · {formatGhs(item.revenuePesewas)} at{' '}
                    {item.marginPercent != null ? `${item.marginPercent}% margin` : 'no cost set'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-primary">
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
