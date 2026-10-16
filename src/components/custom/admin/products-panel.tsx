// Platform product intelligence: buy rate across every shop.
'use client';

import { Activity, Package, PackageX, ShoppingCart } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { AdminProducts, type AdminProducts as Products } from '@/lib/contracts/admin';
import { formatGhs } from '@/lib/contracts/order';
import { PanelFallback, StatCard } from './shared';

export function ProductsPanel() {
  const [data, setData] = useState<Products | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await apiFetch('/api/admin/products', { schema: AdminProducts }));
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
      <PanelFallback message="Could not load product intelligence." onRetry={() => void load()} />
    );
  }

  return (
    <div className="grid gap-4 sm:gap-6">
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={Package}
          label="Units sold"
          value={String(data.totalUnits)}
          sub={`${formatGhs(data.totalRevenuePesewas)} revenue`}
        />
        <StatCard icon={ShoppingCart} label="Items ranked" value={String(data.items.length)} />
        <StatCard icon={PackageX} label="Out of stock" value={String(data.outOfStock)} />
        <StatCard
          icon={Activity}
          label="Running low"
          value={String(data.lowStock)}
          sub="5 or fewer left"
        />
      </section>

      {data.items.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/40 px-6 py-12 text-center">
          <PackageX aria-hidden className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-h4 font-display">No sales counted yet</p>
          <p className="mx-auto mt-1 max-w-sm text-small text-muted-foreground">
            Buy rates appear here once any shop sells through its storefront.
          </p>
        </div>
      ) : (
        <>
          <ol className="grid gap-3 sm:hidden">
            {data.items.map((item, index) => (
              <li
                key={`${item.slug ?? 'loose'}-${item.name}`}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-caption font-medium text-primary">#{index + 1} fastest</p>
                    <p className="mt-0.5 truncate text-small font-medium">{item.name}</p>
                    <p className="mt-0.5 truncate text-caption text-muted-foreground">
                      {item.shop ?? 'Deleted item'} · {item.units} sold in {item.orderCount}{' '}
                      {item.orderCount === 1 ? 'order' : 'orders'}
                    </p>
                  </div>
                  {item.stock != null && item.stock <= 0 ? (
                    <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-caption font-medium text-destructive">
                      Sold out
                    </span>
                  ) : (
                    item.marginPercent != null && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary">
                        {item.marginPercent}%
                      </span>
                    )
                  )}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <span className="rounded-lg bg-muted/60 px-1 py-1.5">
                    <span className="block font-mono text-small font-semibold">
                      {item.unitsPerDay < 10
                        ? item.unitsPerDay.toFixed(1)
                        : Math.round(item.unitsPerDay)}
                      /day
                    </span>
                    <span className="block text-caption text-muted-foreground">buy rate</span>
                  </span>
                  <span className="rounded-lg bg-muted/60 px-1 py-1.5">
                    <span className="block truncate font-mono text-small font-semibold">
                      {formatGhs(item.revenuePesewas)}
                    </span>
                    <span className="block text-caption text-muted-foreground">revenue</span>
                  </span>
                  <span className="rounded-lg bg-muted/60 px-1 py-1.5">
                    <span className="block truncate font-mono text-small font-semibold">
                      {formatGhs(item.profitPesewas)}
                    </span>
                    <span className="block text-caption text-muted-foreground">profit</span>
                  </span>
                </div>
              </li>
            ))}
          </ol>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/60 text-caption font-medium uppercase tracking-widest text-muted-foreground">
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">Item</th>
                    <th className="px-5 py-3">Buy rate</th>
                    <th className="px-5 py-3">Sold</th>
                    <th className="px-5 py-3">Revenue</th>
                    <th className="px-5 py-3">Profit</th>
                    <th className="px-5 py-3">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((item, index) => (
                    <tr key={`${item.slug ?? 'loose'}-${item.name}`} className="hover:bg-muted/50">
                      <td className="px-5 py-3 font-mono text-small text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-small font-medium">{item.name}</p>
                        <p className="text-caption text-muted-foreground">{item.shop ?? '—'}</p>
                      </td>
                      <td className="px-5 py-3 font-mono text-small font-semibold text-primary">
                        {item.unitsPerDay < 10
                          ? item.unitsPerDay.toFixed(1)
                          : Math.round(item.unitsPerDay)}
                        /day
                      </td>
                      <td className="px-5 py-3 font-mono text-small">
                        {item.units} · {item.orderCount} orders
                      </td>
                      <td className="px-5 py-3 font-mono text-small font-semibold">
                        {formatGhs(item.revenuePesewas)}
                      </td>
                      <td className="px-5 py-3 font-mono text-small font-semibold">
                        {formatGhs(item.profitPesewas)}
                      </td>
                      <td className="px-5 py-3 text-small">
                        {item.stock == null ? (
                          <span className="text-muted-foreground">Untracked</span>
                        ) : item.stock <= 0 ? (
                          <span className="font-semibold text-destructive">Sold out</span>
                        ) : item.stock <= 5 ? (
                          <span className="font-semibold text-primary">{item.stock} left</span>
                        ) : (
                          <span className="text-muted-foreground">{item.stock}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
