// The orders hub: everything cooking, on one floor. Search the whole history,
// filter by status, flip orders straight from the list, and hop into the
// customer who owns each one. Powers ~/dashboard/orders.
'use client';

import { ArrowUpRight, Flame, Package, RefreshCcw, Search } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-client';
import {
  formatGhs,
  OrderItem,
  OrderList,
  type OrderListItem as OrderRecord,
  OrderStatus,
  type OrderStatusValue,
} from '@/lib/contracts/order';

const statusLabels: Record<OrderStatusValue, string> = {
  PENDING: 'Warming up',
  PROCESSING: 'On the fire',
  COMPLETED: 'Served!',
  CANCELLED: 'Rained off',
};

const statusStyles: Record<OrderStatusValue, string> = {
  PENDING: 'bg-amber-300 text-amber-950',
  PROCESSING: 'bg-yellow-600 text-white',
  COMPLETED: 'bg-emerald-600 text-white',
  CANCELLED: 'bg-stone-400 text-stone-900',
};

const FILTERS: Array<{ value: OrderStatusValue | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Warming up' },
  { value: 'PROCESSING', label: 'On the fire' },
  { value: 'COMPLETED', label: 'Served!' },
  { value: 'CANCELLED', label: 'Rained off' },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium' }).format(new Date(value));
}

export function OrdersWorkspace() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [filter, setFilter] = useState<OrderStatusValue | 'ALL'>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async (nextFilter: OrderStatusValue | 'ALL', nextQuery: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (nextFilter !== 'ALL') params.set('status', nextFilter);
      if (nextQuery) params.set('q', nextQuery);
      const queryString = params.toString();
      const result = await apiFetch(`/api/orders${queryString ? `?${queryString}` : ''}`, {
        schema: OrderList,
      });
      setOrders(result.items);
    } catch {
      setError('The stove blinked. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter, query);
  }, [load, filter, query]);

  async function updateStatus(order: OrderRecord, value: string) {
    const parsedStatus = OrderStatus.safeParse(value);
    if (!parsedStatus.success) return;
    setUpdatingId(order.id);
    try {
      const updated = await apiFetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: parsedStatus.data }),
        schema: OrderItem,
      });
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? { ...item, ...updated } : item)),
      );
      toast.success(`Moved to “${statusLabels[parsedStatus.data]}”`);
    } catch {
      toast.error('Stuck — could not move it');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-amber-950 p-7 text-amber-50 sm:p-9">
        <Package
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 size-40 rotate-12 text-amber-900"
        />
        <p className="relative text-xs font-black uppercase tracking-[0.25em] text-amber-300">
          The whole floor
        </p>
        <div className="relative mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl font-black uppercase leading-none sm:text-5xl">
            On the fire
          </h1>
          <Button
            type="button"
            variant="outline"
            onClick={() => void load(filter, query)}
            className="h-11 rounded-full border-2 border-amber-50/40 bg-transparent font-black uppercase tracking-wide text-amber-100 hover:bg-amber-50/10"
          >
            <RefreshCcw aria-hidden className="size-4" /> Cool down &amp; reload
          </Button>
        </div>
        <div className="relative mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <form
            className="relative w-full"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(searchInput.trim());
            }}
          >
            <Search
              aria-hidden
              className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-amber-300"
            />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Hunt by order number, item, or customer…"
              aria-label="Search orders"
              className="h-12 rounded-full border-2 border-amber-50/20 bg-amber-50/10 pl-11 text-amber-50 placeholder:text-amber-300"
            />
          </form>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((entry) => (
              <Button
                key={entry.value}
                type="button"
                size="sm"
                onClick={() => {
                  setFilter(entry.value);
                  if (query) setQuery('');
                }}
                className={`h-9 rounded-full px-4 text-xs font-black uppercase tracking-wide ${
                  filter === entry.value
                    ? 'bg-yellow-600 text-white'
                    : 'border-2 border-amber-50/30 bg-transparent text-amber-200 hover:bg-amber-50/10'
                }`}
              >
                {entry.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-[2rem] border-2 border-dashed border-amber-300 px-6 text-sm font-bold uppercase tracking-widest text-amber-500">
          Fanning the flames…
        </div>
      ) : error ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-[2rem] border-2 border-amber-950 bg-white px-6 text-center dark:bg-stone-900">
          <p role="alert" className="font-bold text-amber-700">
            {error}
          </p>
          <Button
            type="button"
            onClick={() => void load(filter, query)}
            className="rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
          >
            Try again
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-[2rem] border-2 border-dashed border-amber-400 px-6 text-center">
          <span className="flex size-14 -rotate-6 items-center justify-center rounded-3xl bg-yellow-600 text-white">
            <Flame aria-hidden className="size-6" />
          </span>
          <p className="font-display text-xl font-black uppercase">
            {query || filter !== 'ALL' ? 'Nothing here' : 'Cold stove'}
          </p>
          <p className="max-w-sm text-sm font-medium text-stone-500">
            {query || filter !== 'ALL'
              ? 'Loosen the search or pick another status.'
              : 'Orders land here the moment a customer places one on your storefront — or flip one on from any customer page.'}
          </p>
        </div>
      ) : (
        <ol id="orders-queue" className="scroll-mt-24 grid gap-3">
          {orders.map((order, i) => {
            const paid = order.paidAt != null;
            return (
              <li
                key={order.id}
                className={`rounded-[1.75rem] border-2 border-amber-950 bg-white p-5 shadow-[4px_4px_0_0_#451a03] dark:bg-stone-900 sm:p-6 ${
                  i % 2 === 1 ? 'rotate-[0.5deg]' : '-rotate-[0.5deg]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black tracking-wide text-amber-700 dark:text-amber-300">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[0.7rem] font-black uppercase tracking-wider ${statusStyles[order.status]}`}
                      >
                        {statusLabels[order.status]}
                      </span>
                      {paid ? (
                        <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[0.7rem] font-black uppercase tracking-wider text-white">
                          Paid
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-bold">{order.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-stone-500">
                      {order.customerName && (
                        <Link
                          href={`/dashboard/customers/${order.customerId}`}
                          className="inline-flex items-center gap-1 font-black uppercase tracking-wide text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
                        >
                          {order.customerName} <ArrowUpRight aria-hidden className="size-3" />
                        </Link>
                      )}
                      {order.amountPesewas != null && (
                        <span className="font-mono font-black text-stone-700 dark:text-stone-200">
                          {formatGhs(order.amountPesewas)}
                        </span>
                      )}
                      <span>Fired {formatDate(order.createdAt)}</span>
                    </div>
                  </div>
                  <Select
                    value={order.status}
                    onValueChange={(value) => void updateStatus(order, value)}
                    disabled={updatingId === order.id}
                  >
                    <SelectTrigger
                      aria-label="Order status"
                      className="min-w-40 rounded-full border-2 border-amber-950 bg-[#fffbeb]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OrderStatus.options.map((status) => (
                        <SelectItem key={status} value={status}>
                          {statusLabels[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
