// Shops console: the cross-account shop table plus the per-account dossier,
// with the power to open or close a storefront. Client island rendered by the
// /dashboard/admin/shops page.
'use client';

import {
  ArrowLeft,
  Package,
  Search,
  ShoppingCart,
  Store as StoreIcon,
  Users,
  Wallet,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';
import {
  AdminShopDetail,
  AdminShops,
  AdminShopToggleResult,
  type AdminShopDetail as Dossier,
  type AdminShops as Shops,
} from '@/lib/contracts/admin';
import { formatGhs } from '@/lib/contracts/order';
import { formatDate, PanelFallback, StatCard } from './shared';

function ShopsPanel({ onOpen }: { onOpen: (userId: string) => void }) {
  const [shops, setShops] = useState<Shops | null>(null);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    setError(false);
    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : '';
      setShops(await apiFetch(`/api/admin/shops${params}`, { schema: AdminShops }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(query);
  }, [load, query]);

  return (
    <div className="grid gap-4">
      <form
        className="flex w-full gap-2 sm:max-w-md"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(input.trim());
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search owner, phone, shop or slug"
            aria-label="Search shops"
            className="h-11 rounded-md border-border bg-card pl-11"
          />
        </div>
        <Button type="submit" variant="outline" className="h-11 rounded-md font-semibold">
          Search
        </Button>
      </form>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
      ) : error || !shops ? (
        <PanelFallback message="Could not load the shops." onRetry={() => void load(query)} />
      ) : shops.shops.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/40 px-6 py-12 text-center">
          <StoreIcon aria-hidden className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-h4 font-display">No shops match</p>
        </div>
      ) : (
        <>
          <ol className="grid gap-3 sm:hidden">
            {shops.shops.map((shop) => (
              <li key={shop.userId}>
                <button
                  type="button"
                  onClick={() => onOpen(shop.userId)}
                  className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {shop.storeName ?? shop.ownerName}
                      </span>
                      <span className="mt-0.5 block truncate text-caption text-muted-foreground">
                        {shop.ownerName} · {shop.ownerPhone ?? 'no phone'}
                      </span>
                    </span>
                    {shop.storeActive === false ? (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground">
                        Closed
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary">
                        Live
                      </span>
                    )}
                  </span>
                  <span className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <span className="rounded-lg bg-muted/60 px-1 py-1.5">
                      <span className="block font-mono text-small font-semibold">
                        {shop.orderCount}
                      </span>
                      <span className="block text-caption text-muted-foreground">orders</span>
                    </span>
                    <span className="rounded-lg bg-muted/60 px-1 py-1.5">
                      <span className="block font-mono text-small font-semibold">
                        {shop.customerCount}
                      </span>
                      <span className="block text-caption text-muted-foreground">customers</span>
                    </span>
                    <span className="rounded-lg bg-muted/60 px-1 py-1.5">
                      <span className="block truncate font-mono text-small font-semibold">
                        {formatGhs(shop.gmvPesewas)}
                      </span>
                      <span className="block text-caption text-muted-foreground">volume</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/60 text-caption font-medium uppercase tracking-widest text-muted-foreground">
                    <th className="px-5 py-3">Shop</th>
                    <th className="px-5 py-3">Owner</th>
                    <th className="px-5 py-3">Orders</th>
                    <th className="px-5 py-3">Unpaid</th>
                    <th className="px-5 py-3">Volume</th>
                    <th className="px-5 py-3">Last order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shops.shops.map((shop) => (
                    <tr key={shop.userId} className="transition-colors hover:bg-muted/50">
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => onOpen(shop.userId)}
                          className="text-left font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {shop.storeName ?? '—'}
                        </button>
                        <p className="mt-0.5 font-mono text-caption text-muted-foreground">
                          /store/{shop.slug ?? '—'} · {shop.itemCount} items
                        </p>
                      </td>
                      <td className="px-5 py-3 text-small">
                        {shop.ownerName}
                        <p className="font-mono text-caption text-muted-foreground">
                          {shop.ownerPhone ?? '—'}
                        </p>
                      </td>
                      <td className="px-5 py-3 font-mono text-small font-semibold">
                        {shop.orderCount}
                      </td>
                      <td className="px-5 py-3 font-mono text-small font-semibold">
                        {shop.unpaidCount}
                      </td>
                      <td className="px-5 py-3 font-mono text-small font-semibold">
                        {formatGhs(shop.gmvPesewas)}
                      </td>
                      <td className="px-5 py-3 text-small text-muted-foreground">
                        {shop.lastOrderAt ? formatDate(shop.lastOrderAt) : 'Never'}
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

function ShopDossier({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [data, setData] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await apiFetch(`/api/admin/shops/${userId}`, { schema: AdminShopDetail }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleActive = async () => {
    if (!data || data.storeActive == null) return;
    const next = !data.storeActive;
    if (
      !next &&
      !window.confirm(
        `Close ${data.storeName ?? 'this shop'}? The storefront goes offline until you reopen it.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/admin/shops/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: next }),
        schema: AdminShopToggleResult,
      });
      await load();
    } catch {
      // Leave the dossier as it was; the button re-enables for another try.
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />;
  }
  if (error || !data) {
    return <PanelFallback message="Could not load that account." onRetry={() => void load()} />;
  }

  return (
    <div className="grid gap-4 sm:gap-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="-ml-3 mb-3 gap-2 font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" /> Shops
        </Button>
        <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-eyebrow">User dossier</p>
              <h2 className="mt-2 break-words font-display text-h2">{data.ownerName}</h2>
              <p className="mt-1 break-all text-small text-muted-foreground">
                {data.ownerEmail} · {data.ownerPhone ?? 'no phone'}
                {data.phoneVerified ? ' · verified' : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-caption font-medium text-primary">
                  {data.role ?? 'user'}
                </span>
                {data.banned ? (
                  <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-caption font-medium text-destructive">
                    Suspended
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-caption font-medium text-muted-foreground">
                    Active
                  </span>
                )}
                <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-caption text-muted-foreground">
                  /store/{data.slug ?? '—'}
                </span>
                {data.storeActive === false && (
                  <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-caption font-medium text-destructive">
                    Shop closed
                  </span>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant={data.storeActive === false ? 'default' : 'outline'}
              disabled={busy || data.storeActive == null}
              onClick={() => void toggleActive()}
              className="shrink-0 rounded-md font-semibold"
            >
              {data.storeActive == null
                ? 'No storefront'
                : data.storeActive === false
                  ? 'Reopen shop'
                  : 'Close shop'}
            </Button>
          </div>
        </section>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={ShoppingCart}
          label="Orders"
          value={String(data.orderCount)}
          sub={`${formatGhs(data.gmvPesewas)} volume`}
        />
        <StatCard icon={Wallet} label="Collected" value={formatGhs(data.paidPesewas)} />
        <StatCard icon={Users} label="Customers" value={String(data.customerCount)} />
        <StatCard
          icon={Package}
          label="Catalogue"
          value={String(data.itemCount)}
          sub={data.storeName ?? 'no store yet'}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h3 className="text-h4 font-display">Top items by revenue</h3>
          {data.topItems.length === 0 ? (
            <p className="mt-2 text-small text-muted-foreground">No productized sales yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {data.topItems.map((item) => (
                <li key={item.name} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-medium">{item.name}</span>
                    <span className="text-caption text-muted-foreground">{item.units} sold</span>
                  </span>
                  <span className="shrink-0 font-mono text-small font-semibold">
                    {formatGhs(item.revenuePesewas)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h3 className="text-h4 font-display">Recent orders</h3>
          {data.recentOrders.length === 0 ? (
            <p className="mt-2 text-small text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {data.recentOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-caption font-semibold text-primary">
                      {order.orderNumber}
                    </span>
                    <span className="block truncate text-caption text-muted-foreground">
                      {order.customerName ?? 'Walk-in'} · {order.status}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-small font-semibold">
                    {order.amountPesewas != null ? formatGhs(order.amountPesewas) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h3 className="text-h4 font-display">Recent customers</h3>
          {data.recentCustomers.length === 0 ? (
            <p className="mt-2 text-small text-muted-foreground">No customers yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {data.recentCustomers.map((customer) => (
                <li key={customer.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-small font-medium">
                    {customer.name}
                  </span>
                  <span className="shrink-0 text-caption text-muted-foreground">
                    {customer.orderCount} orders
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h3 className="text-h4 font-display">Recent SMS</h3>
          {data.recentSms.length === 0 ? (
            <p className="mt-2 text-small text-muted-foreground">No SMS on this account.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {data.recentSms.map((sms) => (
                <li key={sms.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-small font-semibold">
                      {sms.to}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      {sms.source} · {sms.credits} credits
                    </span>
                  </span>
                  <span
                    title={sms.ok ? 'delivered' : 'failed'}
                    className={`size-2.5 shrink-0 rounded-full ${sms.ok ? 'bg-primary' : 'bg-destructive'}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}

/** The /dashboard/admin/shops island: rows deep-link to a real dossier URL. */
export function ShopsConsole() {
  const router = useRouter();
  return <ShopsPanel onOpen={(userId) => router.push(`/dashboard/admin/shops/${userId}`)} />;
}

/** The /dashboard/admin/shops/[userId] dossier, with a back link to the list. */
export function ShopDossierView({ userId }: { userId: string }) {
  const router = useRouter();
  return <ShopDossier userId={userId} onBack={() => router.push('/dashboard/admin/shops')} />;
}
