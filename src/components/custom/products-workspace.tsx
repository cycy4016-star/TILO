// The Products analytics island: every item's sales, prices, cost and margin —
// a ranking of what moves and what earns.
'use client';

import { Package, PackageX, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { formatGhs } from '@/lib/contracts/order';
import { DashboardProducts, type DashboardProducts as Products } from '@/lib/contracts/products';

export function ProductsWorkspace() {
  const [data, setData] = useState<Products | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/dashboard/products', { schema: DashboardProducts })
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
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />;
  }

  if (error || !data) {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm font-semibold text-destructive">
          We could not load your product performance. Please try again.
        </p>
      </section>
    );
  }

  const totalRevenue = data.items.reduce((sum, item) => sum + item.revenuePesewas, 0);
  const totalProfit = data.items.reduce((sum, item) => sum + item.profitPesewas, 0);
  const totalUnits = data.items.reduce((sum, item) => sum + item.unitCount, 0);

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-widest text-primary">
            <Package aria-hidden className="size-3.5" /> Products
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground">
            <TrendingUp aria-hidden className="size-3.5" /> What moves
          </span>
        </div>
        <h1 className="mt-5 text-3xl font-bold">
          Top <span className="text-primary">sellers.</span>
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Best-sellers, prices, cost and margins — one ranked sheet.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Total sold
          </p>
          <p className="mt-1 text-3xl font-bold text-foreground">{totalUnits}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            across {data.items.length} items ranked
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Revenue
          </p>
          <p className="mt-1 text-3xl font-bold text-foreground">{formatGhs(totalRevenue)}</p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Profit after cost
          </p>
          <p className="mt-1 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatGhs(totalProfit)}
          </p>
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        {data.items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <PackageX aria-hidden className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 text-lg font-semibold">Nothing counted yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              When storefront orders and line-item orders are placed, their prices, costs and
              margins rank here automatically.
            </p>
          </div>
        ) : (
          <div id="ranking-table" className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground">
                  <th className="px-5 py-3">Item</th>
                  <th className="px-5 py-3">Sold</th>
                  <th className="px-5 py-3">Price now</th>
                  <th className="px-5 py-3">Cost</th>
                  <th className="px-5 py-3">Revenue</th>
                  <th className="px-5 py-3">Profit</th>
                  <th className="px-5 py-3">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item) => (
                  <tr key={`${item.name}-${item.currentPricePesewas}`}>
                    <td className="px-5 py-3">
                      <p className="text-sm font-semibold">{item.name}</p>
                      <p className="mt-0.5 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                        {item.active === false ? 'Hidden' : (item.kind ?? 'Custom')}
                      </p>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-semibold">
                      {item.unitCount}
                      <span className="ml-1 text-[0.7rem] text-muted-foreground">
                        · {item.orderCount} orders
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-semibold">
                      {item.currentPricePesewas != null ? formatGhs(item.currentPricePesewas) : '—'}
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-semibold">
                      {item.currentCostPesewas != null ? formatGhs(item.currentCostPesewas) : '—'}
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-semibold">
                      {formatGhs(item.revenuePesewas)}
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatGhs(item.profitPesewas)}
                    </td>
                    <td className="px-5 py-3">
                      {item.marginPercent != null ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
                          {item.marginPercent}%
                        </span>
                      ) : (
                        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                          No cost
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
