// The orders hub: the full order history in one place. Search the whole queue,
// filter by status, move orders straight from the list, and hop into the
// customer who owns each one. Powers ~/dashboard/orders.
'use client';

import { ArrowUpRight, Flame, RefreshCcw, Search } from 'lucide-react';
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
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const statusStyles: Record<OrderStatusValue, string> = {
  PENDING: 'bg-primary/10 text-primary',
  PROCESSING: 'bg-primary text-primary-foreground',
  COMPLETED: 'bg-emerald-600 text-white',
  CANCELLED: 'bg-muted text-muted-foreground',
};

const FILTERS: Array<{ value: OrderStatusValue | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
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
      <section className="relative overflow-hidden rounded-xl border border-border bg-card p-7 sm:p-9">
        <p className="relative text-xs font-semibold uppercase tracking-[0.25em] text-primary">
          Order queue
        </p>
        <div className="relative mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Orders</h1>
          <Button
            type="button"
            variant="outline"
            onClick={() => void load(filter, query)}
            className="h-11 rounded-lg border-border bg-background font-semibold text-foreground hover:bg-muted"
          >
            <RefreshCcw aria-hidden className="size-4" /> Reload
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
              className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by order number, item, or customer"
              aria-label="Search orders"
              className="h-12 rounded-lg border-border bg-background pl-11"
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
                className={`h-9 rounded-lg px-4 text-xs font-semibold ${
                  filter === entry.value
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {entry.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-border px-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Loading…
        </div>
      ) : error ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 text-center">
          <p role="alert" className="font-semibold text-foreground">
            {error}
          </p>
          <Button
            type="button"
            onClick={() => void load(filter, query)}
            className="rounded-lg bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Flame aria-hidden className="size-6" />
          </span>
          <p className="text-xl font-bold">
            {query || filter !== 'ALL' ? 'No orders found' : 'No orders yet'}
          </p>
          <p className="max-w-sm text-sm font-medium text-muted-foreground">
            {query || filter !== 'ALL'
              ? 'Loosen your search or pick another status.'
              : 'Orders land here the moment a customer places one on your storefront — or place one from any customer page.'}
          </p>
        </div>
      ) : (
        <ol id="orders-queue" className="scroll-mt-24 grid gap-3">
          {orders.map((order) => {
            const paid = order.paidAt != null;
            return (
              <li
                key={order.id}
                className="rounded-xl border border-border bg-card p-5 dark:bg-stone-900 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wider ${statusStyles[order.status]}`}
                      >
                        {statusLabels[order.status]}
                      </span>
                      {paid ? (
                        <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-white">
                          Paid
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-bold">{order.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
                      {order.customerName && (
                        <Link
                          href={`/dashboard/customers/${order.customerId}`}
                          className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-2 hover:underline"
                        >
                          {order.customerName} <ArrowUpRight aria-hidden className="size-3" />
                        </Link>
                      )}
                      {order.amountPesewas != null && (
                        <span className="font-mono font-semibold text-foreground">
                          {formatGhs(order.amountPesewas)}
                        </span>
                      )}
                      <span>Created {formatDate(order.createdAt)}</span>
                    </div>
                  </div>
                  <Select
                    value={order.status}
                    onValueChange={(value) => void updateStatus(order, value)}
                    disabled={updatingId === order.id}
                  >
                    <SelectTrigger
                      aria-label="Order status"
                      className="min-w-40 rounded-lg border-border bg-background"
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
