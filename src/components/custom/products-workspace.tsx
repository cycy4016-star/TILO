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
    return (
      <div className="h-64 animate-pulse rounded-[1.75rem] border-2 border-amber-950 bg-white dark:bg-stone-900" />
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-[1.75rem] border-2 border-amber-950 bg-white p-6 dark:bg-stone-900">
        <p className="font-bold text-amber-700">The stock sheet would not open — try again.</p>
      </section>
    );
  }

  const totalRevenue = data.items.reduce((sum, item) => sum + item.revenuePesewas, 0);
  const totalProfit = data.items.reduce((sum, item) => sum + item.profitPesewas, 0);
  const totalUnits = data.items.reduce((sum, item) => sum + item.unitCount, 0);

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-950 via-[#78350f] to-yellow-600 p-8 text-amber-50 sm:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(circle at 85% 20%, #facc15 0, transparent 35%), radial-gradient(circle at 10% 90%, #fcd34d 0, transparent 30%)',
          }}
        />
        <div className="relative flex flex-wrap items-center gap-3">
          <span className="inline-flex -rotate-2 items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.18em] text-amber-950">
            <Package aria-hidden className="size-3.5" /> Products
          </span>
          <span className="inline-flex rotate-1 items-center gap-1.5 rounded-full border-2 border-amber-50/40 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.18em]">
            <TrendingUp aria-hidden className="size-3.5" /> What moves
          </span>
        </div>
        <h1 className="relative mt-5 font-display text-4xl font-black uppercase leading-none sm:text-5xl">
          The loudest <span className="text-amber-300">sellers.</span>
        </h1>
        <p className="relative mt-3 max-w-md font-medium text-amber-100">
          Best-sellers, prices, cost and margins — one ranked sheet.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-[1.75rem] border-2 border-amber-950 bg-white p-6 shadow-[5px_5px_0_0_#451a03] dark:bg-stone-900">
          <p className="text-xs font-black uppercase tracking-widest text-stone-500">Total sold</p>
          <p className="mt-1 font-display text-3xl font-black uppercase leading-none text-amber-950 dark:text-amber-50">
            {totalUnits}
          </p>
          <p className="mt-2 text-sm font-medium text-stone-500">
            across {data.items.length} ranked
          </p>
        </article>
        <article className="-rotate-1 rounded-[1.75rem] border-2 border-amber-950 bg-white p-6 shadow-[5px_5px_0_0_#451a03] dark:bg-stone-900">
          <p className="text-xs font-black uppercase tracking-widest text-stone-500">Revenue</p>
          <p className="mt-1 font-display text-3xl font-black uppercase leading-none text-amber-950 dark:text-amber-50">
            {formatGhs(totalRevenue)}
          </p>
        </article>
        <article className="rotate-1 rounded-[1.75rem] border-2 border-amber-950 bg-white p-6 shadow-[5px_5px_0_0_#451a03] dark:bg-stone-900">
          <p className="text-xs font-black uppercase tracking-widest text-stone-500">
            Profit after cost
          </p>
          <p className="mt-1 font-display text-3xl font-black uppercase leading-none text-emerald-700 dark:text-emerald-400">
            {formatGhs(totalProfit)}
          </p>
        </article>
      </section>

      <section className="overflow-hidden rounded-[2rem] border-2 border-amber-950 bg-[#fffbeb] dark:bg-stone-900">
        {data.items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <PackageX aria-hidden className="mx-auto size-10 text-amber-400" />
            <p className="mt-3 font-display text-xl font-black uppercase">Nothing counted yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm font-medium text-stone-500">
              When storefront orders and line-item orders are placed, their prices, costs and
              margins rank here automatically.
            </p>
          </div>
        ) : (
          <div id="ranking-table" className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b-2 border-amber-950 bg-amber-300 text-[0.7rem] font-black uppercase tracking-[0.14em] text-amber-950">
                  <th className="px-5 py-3">Item</th>
                  <th className="px-5 py-3">Sold</th>
                  <th className="px-5 py-3">Price now</th>
                  <th className="px-5 py-3">Cost</th>
                  <th className="px-5 py-3">Revenue</th>
                  <th className="px-5 py-3">Profit</th>
                  <th className="px-5 py-3">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200 dark:divide-stone-800">
                {data.items.map((item) => (
                  <tr key={`${item.name}-${item.currentPricePesewas}`}>
                    <td className="px-5 py-3">
                      <p className="font-display text-sm font-black uppercase">{item.name}</p>
                      <p className="mt-0.5 text-[0.7rem] font-medium uppercase tracking-wider text-stone-500">
                        {item.active === false ? 'Hid off the shelf' : (item.kind ?? 'Custom')}
                      </p>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-black">
                      {item.unitCount}
                      <span className="ml-1 text-[0.7rem] font-medium text-stone-500">
                        · {item.orderCount} orders
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-black">
                      {item.currentPricePesewas != null ? formatGhs(item.currentPricePesewas) : '—'}
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-black">
                      {item.currentCostPesewas != null ? formatGhs(item.currentCostPesewas) : '—'}
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-black">
                      {formatGhs(item.revenuePesewas)}
                    </td>
                    <td className="px-5 py-3 font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
                      {formatGhs(item.profitPesewas)}
                    </td>
                    <td className="px-5 py-3">
                      {item.marginPercent != null ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.7rem] font-black uppercase tracking-wide text-amber-800 dark:bg-stone-800 dark:text-amber-300">
                          {item.marginPercent}%
                        </span>
                      ) : (
                        <span className="text-[0.7rem] font-black uppercase tracking-wide text-stone-400">
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
