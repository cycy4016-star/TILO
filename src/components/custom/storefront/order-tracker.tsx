'use client';

import {
  Camera,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCcw,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TilzaLogo } from '@/components/custom/tilza-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';
import { formatGhs, type OrderStatusValue } from '@/lib/contracts/order';
import { PublicOrderTracking } from '@/lib/contracts/public-store';
import {
  type SimplePushConfig as PushConfigValue,
  SimplePushConfig,
} from '@/lib/contracts/simple-push';
import { deliveryLocationUrl } from '@/lib/delivery';
import { compressImageFile, validateImageFile } from '@/lib/image';
import { waMessageLink } from '@/lib/phone';
import { subscribeToPush, unsubscribeFromPush } from '@/lib/push-client';

const orderStatus: Record<OrderStatusValue, { label: string; detail: string; className: string }> =
  {
    PENDING: {
      label: 'Order received',
      detail: 'The shop has your order and will confirm it shortly.',
      className: 'bg-primary/10 text-highlight-ink',
    },
    PROCESSING: {
      label: 'Being prepared',
      detail: 'The shop is getting your order ready.',
      className: 'bg-primary/10 text-highlight-ink',
    },
    COMPLETED: {
      label: 'Completed',
      detail: 'This order is complete. Thank you for shopping.',
      className: 'bg-emerald-50 text-emerald-700',
    },
    CANCELLED: {
      label: 'Cancelled',
      detail: 'This order was cancelled. Contact the shop if you need help.',
      className: 'bg-destructive/10 text-destructive',
    },
  };

const deliveryStatus: Record<PublicOrderTracking['deliveryStatus'], string> = {
  NOT_APPLICABLE: 'Not dispatched yet',
  PENDING_DISPATCH: 'Waiting for a rider',
  RIDER_ASSIGNED: 'Rider assigned',
  IN_TRANSIT: 'On the way',
  DELIVERED: 'Delivered',
};

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat('en-GH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function OrderTracker({ token, initial }: { token: string; initial: PublicOrderTracking }) {
  const [order, setOrder] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [pushConfig, setPushConfig] = useState<PushConfigValue | null>(null);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [code, setCode] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const refresh = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRefreshing(true);
      try {
        const next = await apiFetch(`/api/public/orders/${encodeURIComponent(token)}`, {
          schema: PublicOrderTracking,
          cache: 'no-store',
        });
        setOrder(next);
        setRefreshFailed(false);
      } catch {
        setRefreshFailed(true);
      } finally {
        if (showSpinner) setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onFocus = () => void refresh();
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === 'tilza:notification-click') {
        void refresh();
      }
    };

    const timer = window.setInterval(poll, 20_000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', poll);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', poll);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, [refresh]);

  useEffect(() => {
    apiFetch(`/api/public/orders/${encodeURIComponent(token)}/push`, {
      schema: SimplePushConfig,
    })
      .then((config) => {
        setPushConfig(config);
        setPushOn(config.subscribed);
      })
      .catch(() => undefined);
  }, [token]);

  async function enablePush() {
    if (!pushConfig?.publicKey) return;
    setPushBusy(true);
    try {
      const error = await subscribeToPush(
        pushConfig.publicKey,
        `/api/public/orders/${encodeURIComponent(token)}/push`,
      );
      if (error) {
        toast.error(error);
        return;
      }
      setPushOn(true);
      toast.success('Order updates are on for this phone');
    } catch {
      toast.error('Could not turn on order updates.');
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      await unsubscribeFromPush(`/api/public/orders/${encodeURIComponent(token)}/push`);
      setPushOn(false);
      toast.success('Order updates are off for this phone');
    } catch {
      toast.error('Could not turn off order updates.');
    } finally {
      setPushBusy(false);
    }
  }

  async function confirmDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmError(null);
    if (!photo) {
      setConfirmError('Take a photo of the handover first.');
      return;
    }
    const invalid = validateImageFile(photo, 'proof');
    if (invalid) {
      setConfirmError(invalid);
      return;
    }
    setConfirming(true);
    try {
      const compressed = await compressImageFile(photo, 1600, 0.82);
      const upload = new File([compressed], 'handover', { type: compressed.type || photo.type });
      const form = new FormData();
      form.set('code', code);
      form.set('consent', String(consent));
      form.set('file', upload);
      const response = await fetch(`/api/public/orders/${encodeURIComponent(token)}/confirm`, {
        method: 'POST',
        body: form,
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setConfirmError(body?.error ?? 'Could not confirm this delivery.');
        return;
      }
      toast.success('Delivery confirmed. Thank you!');
      setPhoto(null);
      setCode('');
      await refresh();
    } catch {
      setConfirmError('Could not upload the photo. Check your connection and try again.');
    } finally {
      setConfirming(false);
    }
  }

  const status = orderStatus[order.status];
  const pickupMap =
    order.storeLat != null && order.storeLng != null
      ? deliveryLocationUrl(order.storeLat, order.storeLng)
      : null;
  const whatsapp = waMessageLink(
    order.storePhone,
    `Hi ${order.storeName}! I'm checking on order ${order.orderNumber}.`,
  );

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-8 sm:py-12">
      <header className="rounded-lg border border-border bg-card p-5 sm:p-7">
        <TilzaLogo className="mb-4 text-lg" />
        <p className="text-eyebrow">Order tracking</p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words font-display text-h2">#{order.orderNumber}</h1>
            <p className="mt-1 text-small text-muted-foreground">
              From{' '}
              {order.storeSlug ? (
                <Link
                  href={`/store/${order.storeSlug}`}
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {order.storeName}
                </Link>
              ) : (
                <span className="font-semibold text-foreground">{order.storeName}</span>
              )}{' '}
              · placed {formatWhen(order.placedAt)}
            </p>
          </div>
          <span
            aria-live="polite"
            className={`rounded-full px-3 py-1.5 text-caption font-semibold ${status.className}`}
          >
            {status.label}
          </span>
        </div>
        <p className="mt-4 text-small text-muted-foreground">{status.detail}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
          <span>Updated {formatWhen(order.updatedAt)}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void refresh(true)}
            disabled={refreshing}
            className="h-8 px-2 font-semibold"
          >
            <RefreshCcw aria-hidden className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        {refreshFailed && (
          <p role="alert" className="mt-2 text-caption font-medium text-destructive">
            Could not refresh. Check your connection — this page will try again.
          </p>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-eyebrow">
            <Clock3 aria-hidden className="size-3.5" /> Order
          </p>
          <p className="mt-2 font-display text-h4">{status.label}</p>
          <p className="mt-1 text-small text-muted-foreground">{status.detail}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-eyebrow">
            {order.fulfillmentMethod === 'LOCAL_DELIVERY' ? (
              <Truck aria-hidden className="size-3.5" />
            ) : (
              <MapPin aria-hidden className="size-3.5" />
            )}
            {order.fulfillmentMethod === 'LOCAL_DELIVERY' ? 'Delivery' : 'Pickup'}
          </p>
          {order.fulfillmentMethod === 'LOCAL_DELIVERY' ? (
            <>
              <p className="mt-2 font-display text-h4">{deliveryStatus[order.deliveryStatus]}</p>
              <p className="mt-1 text-small text-muted-foreground">
                The shop will send a rider to the entrance you pinned at checkout.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-small font-semibold">
                {order.storeAddress || 'Pickup details will be confirmed by the shop.'}
              </p>
              {pickupMap && (
                <a
                  href={pickupMap}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex text-caption font-semibold text-primary underline underline-offset-2"
                >
                  Open pickup map
                </a>
              )}
            </>
          )}
        </div>
      </section>

      {order.courier && (
        <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
          <p className="flex items-center gap-1.5 text-eyebrow">
            <Truck aria-hidden className="size-3.5" /> Your rider
          </p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-highlight font-display text-h4 font-bold text-highlight-foreground">
                {order.courier.name.charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="font-semibold">{order.courier.name}</p>
                <p className="text-caption text-muted-foreground">
                  {order.courier.vehicleType.toLowerCase()}
                  {order.courier.plateNumber ? ` · ${order.courier.plateNumber}` : ''}
                </p>
                {order.courier.lastSeenAt && (
                  <p className="text-caption text-muted-foreground">
                    Last seen {formatWhen(order.courier.lastSeenAt)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {order.courier.phone && (
                <Button asChild variant="outline" size="sm" className="font-semibold">
                  <a href={`tel:${order.courier.phone}`}>
                    <Phone aria-hidden className="size-4" /> Call rider
                  </a>
                </Button>
              )}
              {waMessageLink(
                order.courier.phone,
                `Hi ${order.courier.name}, I'm the buyer for order #${order.orderNumber}.`,
              ) && (
                <Button asChild variant="outline" size="sm" className="font-semibold">
                  <a
                    href={
                      waMessageLink(
                        order.courier.phone,
                        `Hi ${order.courier.name}, I'm the buyer for order #${order.orderNumber}.`,
                      ) ?? '#'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                </Button>
              )}
              {order.courier.lat != null && order.courier.lng != null && (
                <Button asChild variant="ghost" size="sm" className="font-semibold">
                  <a
                    href={deliveryLocationUrl(order.courier.lat, order.courier.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin aria-hidden className="size-4" /> Rider location
                  </a>
                </Button>
              )}
            </div>
          </div>

          {order.handoffCode && !order.buyerConfirmedAt && (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="flex items-center gap-1.5 text-caption font-semibold text-primary">
                <ShieldCheck aria-hidden className="size-3.5" /> Handoff code
              </p>
              <p className="mt-1 font-mono text-h2 tracking-[0.2em]">{order.handoffCode}</p>
              <p className="mt-1 text-caption text-muted-foreground">
                Read this code to the rider only when the order is in your hands.
              </p>
            </div>
          )}

          {order.canConfirm && (
            <form
              onSubmit={confirmDelivery}
              className="mt-4 grid gap-3 border-t border-border pt-4"
            >
              <div>
                <p className="font-semibold">Confirm you received it</p>
                <p className="text-caption text-muted-foreground">
                  Enter the code above and take a photo of the handover. The shop sees the photo; it
                  is private unless you tick the marketing box.
                </p>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="handoff-code" className="text-caption font-semibold">
                  Handoff code
                </label>
                <Input
                  id="handoff-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={6}
                  className="font-mono text-h4 tracking-[0.2em]"
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="handoff-photo" className="text-caption font-semibold">
                  Handover photo
                </label>
                <input
                  id="handoff-photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
                  className="block w-full rounded-md border border-border bg-background px-3 py-2 text-small file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-caption file:font-semibold"
                />
              </div>
              <label className="flex items-start gap-2 text-caption text-muted-foreground">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                The shop may use this delivery photo in its approved gallery. Optional.
              </label>
              {confirmError && (
                <p role="alert" className="text-caption font-medium text-destructive">
                  {confirmError}
                </p>
              )}
              <Button type="submit" disabled={confirming} className="h-10 font-semibold">
                {confirming ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Camera aria-hidden className="size-4" />
                )}
                Confirm delivery
              </Button>
            </form>
          )}

          {order.buyerConfirmedAt && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-small font-semibold text-emerald-700">
              <CheckCircle2 aria-hidden className="size-4" />
              You confirmed this delivery on {formatWhen(order.buyerConfirmedAt)}.
            </p>
          )}

          {!order.canConfirm && !order.buyerConfirmedAt && (
            <p className="mt-4 text-caption text-muted-foreground">
              You can confirm with the handoff code and a photo once the rider marks the order as
              delivered.
            </p>
          )}
        </section>
      )}

      <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="font-display text-h3">Your items</h2>
        <ul className="mt-3 grid gap-2">
          {order.lines.map((line, index) => (
            <li
              key={`${index}-${line.name}`}
              className="flex items-baseline justify-between gap-3 text-small"
            >
              <span className="min-w-0">
                <span className="font-mono text-muted-foreground">{line.quantity}x</span>{' '}
                <span className="break-words">{line.name}</span>
              </span>
              <span className="shrink-0 font-mono">{formatGhs(line.lineTotalPesewas)}</span>
            </li>
          ))}
        </ul>
        {order.totalPesewas != null && (
          <p className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3 text-small font-semibold">
            <span>Total</span>
            <span className="font-mono">{formatGhs(order.totalPesewas)}</span>
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <p className="flex items-center gap-1.5 text-eyebrow">
          <CheckCircle2 aria-hidden className="size-3.5" /> Keep this page
        </p>
        <p className="mt-2 text-small text-muted-foreground">
          Updates appear here automatically. Bookmark this page to check back without asking the
          shop.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {pushConfig?.configured && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void (pushOn ? disablePush() : enablePush())}
              disabled={pushBusy}
              className="h-10 font-semibold"
            >
              {pushBusy ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <ShieldCheck aria-hidden className="size-4" />
              )}
              {pushOn ? 'Updates on this phone' : 'Get updates on this phone'}
            </Button>
          )}
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-small font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              <MessageCircle aria-hidden className="size-4" /> Chat with the shop
            </a>
          )}
          {order.storeSlug && (
            <Button asChild variant="outline" className="h-10 font-semibold">
              <Link href={`/store/${order.storeSlug}`}>Back to shop</Link>
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
