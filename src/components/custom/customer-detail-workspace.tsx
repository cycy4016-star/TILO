// Tilo customer detail island: story, orders, and loud status flips.
'use client';

import {
  ArrowLeft,
  Flame,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareMore,
  Phone,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { OrderForm } from '@/components/custom/order-form';
import { SmsComposer } from '@/components/custom/sms-composer';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-client';
import { CustomerDetail, type CustomerDetail as CustomerRecord } from '@/lib/contracts/customer';
import {
  formatGhs,
  OrderItem,
  type OrderItem as OrderRecord,
  OrderStatus,
} from '@/lib/contracts/order';
import { PaymentInitializeResult } from '@/lib/contracts/payment';
import { waMeLink } from '@/lib/phone';
import { orderConfirmationSms } from '@/lib/sms-templates';
import { useStoreName } from '@/lib/use-store-name';

const statusLabels: Record<OrderRecord['status'], string> = {
  PENDING: 'Warming up',
  PROCESSING: 'On the fire',
  COMPLETED: 'Served!',
  CANCELLED: 'Rained off',
};

const statusStyles: Record<OrderRecord['status'], string> = {
  PENDING: 'bg-amber-300 text-amber-950',
  PROCESSING: 'bg-yellow-600 text-white',
  COMPLETED: 'bg-emerald-600 text-white',
  CANCELLED: 'bg-stone-400 text-stone-900',
};

const statusDots: Record<OrderRecord['status'], string> = {
  PENDING: 'bg-amber-300',
  PROCESSING: 'bg-yellow-600',
  COMPLETED: 'bg-emerald-600',
  CANCELLED: 'bg-stone-400',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium' }).format(new Date(value));
}

function isNotFound(error: unknown) {
  return error instanceof Error && error.message.includes('(404)');
}

export function CustomerDetailWorkspace({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const storeName = useStoreName();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);
    apiFetch(`/api/customers/${customerId}`, { schema: CustomerDetail })
      .then((result) => {
        if (!cancelled) setCustomer(result);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        if (isNotFound(requestError)) setNotFound(true);
        else setError('The story tore. Try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  async function updateStatus(orderId: string, value: string) {
    const parsedStatus = OrderStatus.safeParse(value);
    if (!parsedStatus.success) return;
    setUpdatingOrderId(orderId);
    try {
      const updated = await apiFetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: parsedStatus.data }),
        schema: OrderItem,
      });
      setCustomer((current) =>
        current
          ? {
              ...current,
              orders: current.orders.map((order) => (order.id === orderId ? updated : order)),
            }
          : current,
      );
      toast.success('Moved along the fire!');
    } catch {
      toast.error('Stuck — could not move it');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function handleOrderCreated(order: OrderRecord) {
    setCustomer((current) =>
      current
        ? { ...current, orders: [order, ...current.orders], orderCount: current.orderCount + 1 }
        : current,
    );
  }

  async function markPaid(orderId: string) {
    setUpdatingOrderId(orderId);
    try {
      const updated = await apiFetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ paidAt: new Date().toISOString() }),
        schema: OrderItem,
      });
      setCustomer((current) =>
        current
          ? {
              ...current,
              orders: current.orders.map((order) => (order.id === orderId ? updated : order)),
            }
          : current,
      );
      toast.success('Payment in — the receipt fires on the next sweep.');
    } catch {
      toast.error('Could not mark it paid — try again');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function collectPayment(orderId: string) {
    setUpdatingOrderId(orderId);
    try {
      const result = await apiFetch('/api/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({ orderId }),
        schema: PaymentInitializeResult,
      });
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      const cause = (error as { cause?: unknown }).cause as { error?: string } | undefined;
      toast.error(cause?.error ?? 'Could not start the payment — try again');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center font-display text-sm font-black uppercase tracking-[0.25em] text-amber-500">
        Unfolding the story…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border-2 border-amber-950 bg-white p-8 text-center dark:bg-stone-900">
        <p className="font-display text-2xl font-black uppercase">Lost page</p>
        <p className="mt-2 text-sm font-medium text-stone-500">
          This regular may have moved on or the link is stale.
        </p>
        <Button
          asChild
          className="mt-5 rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
        >
          <Link href="/dashboard/customers">Back to the wall</Link>
        </Button>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border-2 border-amber-950 bg-white p-8 text-center dark:bg-stone-900">
        <p className="font-display text-2xl font-black uppercase">Torn page</p>
        <p className="mt-2 text-sm font-medium text-stone-500">
          {error ?? 'The story came back empty.'}
        </p>
        <Button
          asChild
          className="mt-5 rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
        >
          <Link href="/dashboard/customers">Back to the wall</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div>
        <Button
          asChild
          variant="ghost"
          className="-ml-3 mb-3 gap-2 font-black uppercase tracking-wide text-amber-700 dark:text-amber-300"
        >
          <Link href="/dashboard/customers">
            <ArrowLeft aria-hidden className="size-4" /> The wall
          </Link>
        </Button>
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-yellow-600 to-amber-400 p-7 text-white sm:p-9">
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-8 -right-4 font-display text-[9rem] font-black leading-none text-white/15"
          >
            {customer.name.charAt(0).toUpperCase()}
          </span>
          <p className="relative text-xs font-black uppercase tracking-[0.25em] text-amber-200">
            Regular № {customer.orderCount}
          </p>
          <h1 className="relative mt-2 font-display text-4xl font-black uppercase leading-none sm:text-5xl">
            {customer.name}
          </h1>
          {customer.company && (
            <p className="relative mt-2 font-bold text-amber-50">{customer.company}</p>
          )}
          <div className="relative mt-4 flex flex-wrap gap-2 text-xs font-bold">
            {customer.email && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
                <Mail aria-hidden className="size-3.5" />
                <span className="break-all">{customer.email}</span>
              </span>
            )}
            {customer.phone && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
                <Phone aria-hidden className="size-3.5" />
                {customer.phone}
              </span>
            )}
            {customer.address && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
                <MapPin aria-hidden className="size-3.5" />
                {customer.address}
              </span>
            )}
          </div>
          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            {customer.phone &&
              (() => {
                const chat = waMeLink(customer.phone);
                return chat ? (
                  <a
                    href={chat}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-emerald-600 px-5 font-black uppercase tracking-wide text-white shadow-[3px_3px_0_0_rgba(0,0,0,0.25)] transition-colors hover:bg-emerald-500"
                  >
                    <MessageCircle aria-hidden className="size-4" /> Chat on WhatsApp
                  </a>
                ) : null;
              })()}
            {customer.phone && storeName && (
              <SmsComposer
                phone={customer.phone}
                customerName={customer.name}
                storeName={storeName}
                trigger={
                  <Button
                    type="button"
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-amber-950 px-5 font-black uppercase tracking-wide text-amber-50 shadow-[3px_3px_0_0_rgba(0,0,0,0.25)] transition-colors hover:bg-stone-900"
                  >
                    <MessageSquareMore aria-hidden className="size-4" /> Text them
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <section className="rounded-[2rem] border-2 border-amber-950 bg-white p-6 dark:bg-stone-900 sm:p-7">
          <h2 className="font-display text-2xl font-black uppercase">On the fire</h2>
          <p className="mt-1 text-sm font-medium text-stone-500">
            Everything cooking for {customer.name}.
          </p>
          {customer.orders.length === 0 ? (
            <div className="mt-5 rounded-[1.5rem] border-2 border-dashed border-amber-400 px-5 py-10 text-center">
              <p className="font-display font-black uppercase">Cold stove</p>
              <p className="mt-1 text-sm font-medium text-stone-500">
                Fire the first order from the panel.
              </p>
            </div>
          ) : (
            <ol
              id="customer-timeline"
              className="relative mt-6 space-y-6 before:absolute before:bottom-2 before:left-[7px] before:top-1 before:w-0.5 before:bg-amber-300 dark:before:bg-amber-800"
            >
              {customer.orders.map((order) => (
                <li key={order.id} className="relative pl-9">
                  <span
                    aria-hidden
                    className={`absolute left-0 top-1.5 size-4 rounded-full border-4 border-white dark:border-stone-900 ${statusDots[order.status]}`}
                  />
                  <div className="rounded-[1.5rem] bg-amber-50 p-4 dark:bg-stone-800 sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
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
                      </div>
                      <p className="mt-2 text-sm font-bold">{order.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {order.amountPesewas != null && (
                          <span className="font-mono text-sm font-black text-stone-800 dark:text-stone-100">
                            {formatGhs(order.amountPesewas)}
                          </span>
                        )}
                        {order.paidAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[0.7rem] font-black uppercase tracking-wider text-white">
                            Paid {formatDate(order.paidAt)}
                          </span>
                        ) : order.amountPesewas != null ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              disabled={updatingOrderId === order.id}
                              onClick={() => void collectPayment(order.id)}
                              className="h-7 rounded-full bg-yellow-600 text-[0.7rem] font-black uppercase tracking-wider text-white hover:bg-amber-700"
                            >
                              Collect payment
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={updatingOrderId === order.id}
                              onClick={() => void markPaid(order.id)}
                              className="h-7 rounded-full text-[0.7rem] font-black uppercase tracking-wider"
                            >
                              Mark paid
                            </Button>
                          </>
                        ) : null}
                        {customer.phone && storeName && (
                          <SmsComposer
                            phone={customer.phone}
                            customerName={customer.name}
                            storeName={storeName}
                            templateKey="order-confirm"
                            defaultMessage={orderConfirmationSms({
                              storeName,
                              customerName: customer.name,
                              orderNumber: order.orderNumber,
                              description: order.description,
                            })}
                            trigger={
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={updatingOrderId === order.id}
                                className="h-7 rounded-full border-2 border-amber-950 text-[0.7rem] font-black uppercase tracking-wider"
                              >
                                <MessageSquareMore aria-hidden className="size-3" /> Confirm by SMS
                              </Button>
                            }
                          />
                        )}
                      </div>
                      <p className="mt-1 text-xs font-medium text-stone-500">
                        Fired {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <Select
                      value={order.status}
                      onValueChange={(value) => void updateStatus(order.id, value)}
                      disabled={updatingOrderId === order.id}
                    >
                      <SelectTrigger className="mt-3 w-full rounded-full sm:mt-0 sm:w-40">
                        <SelectValue aria-label="Order status" />
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
              ))}
            </ol>
          )}
        </section>

        <div className="grid content-start gap-6">
          <section
            id="fresh-order"
            className="scroll-mt-24 rotate-1 rounded-[2rem] bg-amber-950 p-6 text-amber-50 sm:p-7"
          >
            <h2 className="flex items-center gap-2 font-display text-xl font-black uppercase text-amber-300">
              <Flame className="size-5" aria-hidden /> Fresh order
            </h2>
            <p className="mt-1 text-sm font-medium text-amber-200">What&apos;s cooking next?</p>
            <div className="mt-4 rounded-[1.5rem] bg-white p-4 text-stone-900 dark:bg-stone-900 dark:text-amber-50">
              <OrderForm customerId={customer.id} onCreated={handleOrderCreated} />
            </div>
          </section>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-500">
        <Zap aria-hidden className="size-3.5" /> Flips save the instant you pick them.
      </div>
    </div>
  );
}
