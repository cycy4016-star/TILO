// The Products analytics island: every item's sales, prices, cost and margin —
// a ranking of what moves and what earns.
'use client';

import { Package, PackageX, RefreshCcw, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { formatGhs } from '@/lib/contracts/order';
import { DashboardProducts, type DashboardProducts as Products } from '@/lib/contracts/products';

export function ProductsWorkspace({ hideIntro = false }: { hideIntro?: boolean }) {
  const [data, setData] = useState<Products | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await apiFetch('/api/dashboard/products', { schema: DashboardProducts }));
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
      <section className="grid gap-3 rounded-xl border border-border bg-muted/40 p-6 text-center">
        <p className="text-small font-medium text-destructive">
          We could not load your product performance. Please try again.
        </p>
        <Button
          type="button"
          onClick={() => void load()}
          className="h-9 justify-self-center rounded-md font-semibold"
        >
          Try again
        </Button>
      </section>
    );
  }

  const totalRevenue = data.items.reduce((sum, item) => sum + item.revenuePesewas, 0);
  const totalProfit = data.items.reduce((sum, item) => sum + item.profitPesewas, 0);
  const totalUnits = data.items.reduce((sum, item) => sum + item.unitCount, 0);

  return (
    <div className="grid gap-6">
      {!hideIntro && (
        <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-caption font-semibold text-primary">
              <Package aria-hidden className="size-3.5" /> Products
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-caption font-medium text-muted-foreground">
              <TrendingUp aria-hidden className="size-3.5" /> What moves
            </span>
          </div>
          <h1 className="mt-5 text-h1 font-display">
            Top <span className="text-primary">sellers.</span>
          </h1>
          <p className="mt-2 max-w-md text-small text-muted-foreground">
            Best-sellers, prices, cost and margins — one ranked sheet.
          </p>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-caption font-medium text-muted-foreground">Total sold</p>
          <p className="mt-1 font-display text-h3 text-foreground">{totalUnits}</p>
          <p className="mt-2 text-small text-muted-foreground">
            across {data.items.length} items ranked
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-caption font-medium text-muted-foreground">Revenue</p>
          <p className="mt-1 font-display text-h3 text-foreground">{formatGhs(totalRevenue)}</p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-caption font-medium text-muted-foreground">Profit after cost</p>
          <p className="mt-1 font-display text-h3 text-primary">{formatGhs(totalProfit)}</p>
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        {data.items.length === 0 ? (
          <div className="bg-muted/40 px-6 py-12 text-center">
            <PackageX aria-hidden className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 text-h4 font-display">Nothing counted yet</p>
            <p className="mx-auto mt-1 max-w-sm text-small text-muted-foreground">
              When storefront orders and line-item orders are placed, their prices, costs and
              margins rank here automatically.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <p className="text-caption font-medium text-muted-foreground">
                Ranked by revenue · {data.items.length} {data.items.length === 1 ? 'item' : 'items'}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void load()}
                disabled={loading}
                className="h-8 rounded-md font-semibold text-muted-foreground hover:text-foreground"
              >
                <RefreshCcw aria-hidden className="size-3.5" /> Reload
              </Button>
            </div>
            <ol className="grid gap-3 p-3 sm:hidden">
              {data.items.map((item) => (
                <li
                  key={`${item.name}-${item.currentPricePesewas}`}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-small font-medium">{item.name}</p>
                      <p className="mt-0.5 text-caption text-muted-foreground">
                        {item.active === false ? 'Hidden' : (item.kind ?? 'Custom')} ·{' '}
                        {item.unitCount} sold · {item.orderCount}{' '}
                        {item.orderCount === 1 ? 'order' : 'orders'}
                      </p>
                    </div>
                    {item.marginPercent != null ? (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary">
                        {item.marginPercent}%
                      </span>
                    ) : (
                      <span className="shrink-0 text-caption font-medium text-muted-foreground">
                        No cost
                      </span>
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <dt className="text-caption text-muted-foreground">Price now</dt>
                      <dd className="truncate font-mono text-small font-semibold">
                        {item.currentPricePesewas != null
                          ? formatGhs(item.currentPricePesewas)
                          : '—'}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-caption text-muted-foreground">Cost</dt>
                      <dd className="truncate font-mono text-small font-semibold">
                        {item.currentCostPesewas != null ? formatGhs(item.currentCostPesewas) : '—'}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-caption text-muted-foreground">Revenue</dt>
                      <dd className="truncate font-mono text-small font-semibold">
                        {formatGhs(item.revenuePesewas)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-caption text-muted-foreground">Profit</dt>
                      <dd className="truncate font-mono text-small font-semibold">
                        {formatGhs(item.profitPesewas)}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ol>
            <div id="ranking-table" className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/60 text-caption font-medium uppercase tracking-widest text-muted-foreground">
                    <th className="sticky left-0 z-10 bg-muted px-5 py-3 shadow-[1px_0_0_0_var(--border)]">
                      Item
                    </th>
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
                    <tr
                      key={`${item.name}-${item.currentPricePesewas}`}
                      className="hover:bg-muted/50"
                    >
                      <td className="sticky left-0 z-10 bg-card px-5 py-3 shadow-[1px_0_0_0_var(--border)]">
                        <p className="max-w-[140px] truncate text-small font-medium sm:max-w-none">
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-caption text-muted-foreground">
                          {item.active === false ? 'Hidden' : (item.kind ?? 'Custom')}
                        </p>
                      </td>
                      <td className="px-5 py-3 font-mono text-small font-semibold">
                        {item.unitCount}
                        <span className="ml-1 text-caption text-muted-foreground">
                          · {item.orderCount} orders
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-small font-semibold">
                        {item.currentPricePesewas != null
                          ? formatGhs(item.currentPricePesewas)
                          : '—'}
                      </td>
                      <td className="px-5 py-3 font-mono text-small font-semibold">
                        {item.currentCostPesewas != null ? formatGhs(item.currentCostPesewas) : '—'}
                      </td>
                      <td className="px-5 py-3 font-mono text-small font-semibold">
                        {formatGhs(item.revenuePesewas)}
                      </td>
                      <td className="px-5 py-3 font-mono text-small font-semibold text-foreground">
                        {formatGhs(item.profitPesewas)}
                      </td>
                      <td className="px-5 py-3">
                        {item.marginPercent != null ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary">
                            {item.marginPercent}%
                          </span>
                        ) : (
                          <span className="text-caption font-medium text-muted-foreground">
                            No cost
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
