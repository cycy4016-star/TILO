// Platform ops center: the operator's Splunk-style monitor. Overview totals +
// 14-day activity bars, per-shop table with full user dossiers, product buy
// rates across every shop, a free-text event search, and the account list.
// Renders only inside the admin-gated page (never fetches unless mounted
// there) — this is the ONE surface that reads across shops.
'use client';

import {
  Activity,
  ArrowLeft,
  Package,
  PackageX,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Store as StoreIcon,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';
import {
  AdminOverview,
  AdminProducts,
  AdminShopDetail,
  AdminShops,
  AdminUserMonitor,
  type AdminShopDetail as Dossier,
  type OpsEvents as Events,
  type AdminUserMonitor as Monitor,
  type OpsEventKind,
  OpsEvents,
  type AdminOverview as Overview,
  type AdminProducts as Products,
  type AdminShops as Shops,
} from '@/lib/contracts/admin';
import { formatGhs } from '@/lib/contracts/order';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function PanelFallback({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/40 p-6 text-center">
      <p className="text-small font-medium text-foreground">{message}</p>
      <Button type="button" onClick={onRetry} className="h-9 rounded-md font-semibold">
        Try again
      </Button>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="mt-3 break-words text-caption font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-display text-h3 text-foreground">{value}</p>
      {sub && <p className="mt-1 text-small text-muted-foreground">{sub}</p>}
    </article>
  );
}

function OverviewPanel() {
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
          sub={`${data.items} items listed`}
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

function ProductsPanel() {
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

const EVENT_KINDS: { value: OpsEventKind | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'order', label: 'Orders' },
  { value: 'sms', label: 'SMS' },
  { value: 'payment', label: 'Payments' },
  { value: 'signup', label: 'Signups' },
];

const EVENT_BADGES: Record<OpsEventKind, string> = {
  order: 'bg-primary/10 text-primary',
  sms: 'bg-muted text-muted-foreground',
  payment: 'bg-primary/10 text-primary',
  signup: 'bg-muted text-foreground',
  store: 'bg-muted text-muted-foreground',
};

function EventsPanel() {
  const [events, setEvents] = useState<Events | null>(null);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<OpsEventKind | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (search: string, source: OpsEventKind | '') => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (source) params.set('kind', source);
      const suffix = params.toString();
      setEvents(
        await apiFetch(`/api/admin/events${suffix ? `?${suffix}` : ''}`, { schema: OpsEvents }),
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(query, kind);
  }, [load, query, kind]);

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
            placeholder="Search orders, numbers, shops, errors…"
            aria-label="Search platform events"
            className="h-11 rounded-md border-border bg-card pl-11"
          />
        </div>
        <Button type="submit" variant="outline" className="h-11 rounded-md font-semibold">
          Hunt
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {EVENT_KINDS.map((entry) => (
          <Button
            key={entry.label}
            type="button"
            size="sm"
            onClick={() => setKind(entry.value)}
            className={`h-9 rounded-md px-4 text-small font-medium ${
              kind === entry.value
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
      ) : error || !events ? (
        <PanelFallback
          message="Could not load the event stream."
          onRetry={() => void load(query, kind)}
        />
      ) : events.events.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/40 px-6 py-12 text-center">
          <Activity aria-hidden className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-h4 font-display">Nothing in the stream</p>
          <p className="mx-auto mt-1 max-w-sm text-small text-muted-foreground">
            No events match that hunt yet — loosen the query or pick another source.
          </p>
        </div>
      ) : (
        <ol className="grid gap-2">
          {events.events.map((event) => (
            <li
              key={event.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 sm:p-4"
            >
              <span
                aria-hidden
                className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                  event.ok == null
                    ? 'bg-muted-foreground'
                    : event.ok
                      ? 'bg-primary'
                      : 'bg-destructive'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-medium">{event.summary}</p>
                <p className="mt-0.5 truncate text-caption text-muted-foreground">
                  {[event.shop, event.detail].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-caption font-medium uppercase tracking-wide ${EVENT_BADGES[event.kind]}`}
                >
                  {event.kind}
                </span>
                <span className="text-caption text-muted-foreground">{formatDate(event.ts)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function AccountsPanel() {
  const [data, setData] = useState<Monitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await apiFetch('/api/admin/users', { schema: AdminUserMonitor }));
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
    return <PanelFallback message="Could not load the account list." onRetry={() => void load()} />;
  }

  return (
    <div id="accounts-table" className="grid scroll-mt-24 gap-4 sm:gap-6">
      <section className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={Users} label="Accounts" value={String(data.totalUsers)} />
        <StatCard icon={ShieldCheck} label="Admins" value={String(data.adminCount)} />
        <StatCard icon={UserCheck} label="Active this month" value={String(data.activeThisMonth)} />
      </section>

      {data.users.length === 0 ? (
        <div className="rounded-xl bg-muted/40 px-6 py-12 text-center">
          <ShieldAlert aria-hidden className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-h4 font-display">No accounts yet</p>
        </div>
      ) : (
        <>
          <ol className="grid gap-3 sm:hidden">
            {data.users.map((user) => (
              <li key={user.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{user.name}</p>
                    <p className="mt-0.5 truncate text-caption text-muted-foreground">
                      {user.email}
                    </p>
                    <p className="mt-0.5 font-mono text-caption text-muted-foreground">
                      {user.phone ?? 'no phone'} · {user.sessionCount} sign-ins
                    </p>
                  </div>
                  {user.banned ? (
                    <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-caption font-medium uppercase tracking-wide text-destructive">
                      Suspended
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium uppercase tracking-wide text-primary">
                      Active
                    </span>
                  )}
                </div>
                <p className="mt-2 text-caption text-muted-foreground">
                  Last seen {user.lastSeenAt ? formatDate(user.lastSeenAt) : 'never'}
                </p>
              </li>
            ))}
          </ol>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/60 text-caption font-medium uppercase tracking-widest text-muted-foreground">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Sign-ins</th>
                    <th className="px-5 py-3">Last seen</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.users.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-5 py-3">
                        <p className="text-small font-medium">{user.name}</p>
                        <p className="mt-0.5 text-caption text-muted-foreground">{user.email}</p>
                      </td>
                      <td className="px-5 py-3 font-mono text-small font-semibold">
                        {user.phone ?? '—'}
                      </td>
                      <td className="px-5 py-3 font-mono text-small font-semibold">
                        {user.sessionCount}
                      </td>
                      <td className="px-5 py-3 text-small text-muted-foreground">
                        {user.lastSeenAt ? formatDate(user.lastSeenAt) : 'Never'}
                      </td>
                      <td className="px-5 py-3">
                        {user.banned ? (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-caption font-medium uppercase tracking-wide text-destructive">
                            Suspended
                          </span>
                        ) : (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium uppercase tracking-wide text-primary">
                            Active
                          </span>
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

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'shops', label: 'Shops' },
  { key: 'products', label: 'Products' },
  { key: 'events', label: 'Events' },
  { key: 'accounts', label: 'Accounts' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function AdminMonitor() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [dossierUserId, setDossierUserId] = useState<string | null>(null);

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-border bg-card p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-caption font-medium uppercase tracking-wide text-primary">
            <ShieldCheck aria-hidden className="size-3.5" /> Admin
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-caption font-medium uppercase tracking-wide text-muted-foreground">
            <Activity aria-hidden className="size-3.5" /> Platform monitor
          </span>
        </div>
        <h1 className="mt-4 break-words font-display text-h1">
          Mission <span className="text-primary">control.</span>
        </h1>
        <p className="mt-2 max-w-md text-body text-muted-foreground">
          Every shop, product, order and event on the platform — live, in one room.
        </p>
      </section>

      <nav
        aria-label="Monitor sections"
        className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0"
      >
        <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              aria-pressed={tab === entry.key && dossierUserId === null}
              onClick={() => {
                setTab(entry.key);
                setDossierUserId(null);
              }}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-small font-medium transition-colors ${
                tab === entry.key && dossierUserId === null
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </nav>

      {dossierUserId ? (
        <ShopDossier userId={dossierUserId} onBack={() => setDossierUserId(null)} />
      ) : tab === 'overview' ? (
        <OverviewPanel />
      ) : tab === 'shops' ? (
        <ShopsPanel onOpen={setDossierUserId} />
      ) : tab === 'products' ? (
        <ProductsPanel />
      ) : tab === 'events' ? (
        <EventsPanel />
      ) : (
        <AccountsPanel />
      )}
    </div>
  );
}
