// Public rider gig view. Mobile-first: one map, one accept action, then a
// native Google Maps handoff. The accept POST is race-guarded server-side; a
// losing rider sees a clear "already taken" message.
'use client';

import { Check, ExternalLink, Loader2, MapPin, Navigation, Package } from 'lucide-react';
import { useState } from 'react';
import { DeliveryMap } from '@/components/custom/delivery-map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api-client';
import { DeliveryAcceptResult } from '@/lib/contracts/delivery';
import { type DeliveryStatusValue, formatGhs } from '@/lib/contracts/order';
import { deliveryDirectionsUrl, deliveryLocationUrl, haversineDistanceKm } from '@/lib/delivery';

export type RiderJobData = {
  orderNumber: string;
  description: string;
  deliveryStatus: DeliveryStatusValue;
  deliveryFeePesewas: number;
  riderId: string | null;
  store: {
    name: string;
    address: string | null;
    lat: number;
    lng: number;
  };
  customer: {
    lat: number;
    lng: number;
  };
};

const STATUS_COPY: Record<DeliveryStatusValue, string> = {
  NOT_APPLICABLE: 'This order has not been broadcast yet.',
  PENDING_DISPATCH: 'Open for a rider to accept.',
  RIDER_ASSIGNED: 'A rider has accepted this gig.',
  IN_TRANSIT: 'This delivery is on the road.',
  DELIVERED: 'This delivery is complete.',
};

export function RiderJob({ job }: { job: RiderJobData }) {
  const [riderId, setRiderId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimedBy, setClaimedBy] = useState(job.riderId);
  const [status, setStatus] = useState<DeliveryStatusValue>(job.deliveryStatus);
  const [directionsUrl, setDirectionsUrl] = useState(
    status === 'RIDER_ASSIGNED' || status === 'IN_TRANSIT' || status === 'DELIVERED'
      ? deliveryDirectionsUrl(job.store.lat, job.store.lng, job.customer.lat, job.customer.lng)
      : null,
  );

  const distanceKm = haversineDistanceKm(
    job.store.lat,
    job.store.lng,
    job.customer.lat,
    job.customer.lng,
  );

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch(
        `/api/public/delivery/jobs/${encodeURIComponent(job.orderNumber)}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({ riderId }),
          schema: DeliveryAcceptResult,
        },
      );
      setStatus(result.deliveryStatus);
      setClaimedBy(result.riderId);
      setDirectionsUrl(result.directionsUrl);
    } catch (requestError) {
      const cause = (
        requestError as { cause?: { error?: string; errors?: Record<string, string> } }
      ).cause;
      setError(
        cause?.error ?? Object.values(cause?.errors ?? {})[0] ?? 'Could not accept this gig',
      );
    } finally {
      setBusy(false);
    }
  }

  const accepted = status !== 'PENDING_DISPATCH' && status !== 'NOT_APPLICABLE';

  return (
    <main className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-6">
      <section className="rounded-lg border border-border bg-card p-5">
        <p className="flex items-center gap-1.5 text-eyebrow">
          <Package aria-hidden className="size-3.5" /> Delivery gig
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
          <h1 className="font-display text-h2 tracking-tight">{job.orderNumber}</h1>
          <span
            className={`rounded-full px-2.5 py-1 text-caption font-semibold ${
              status === 'PENDING_DISPATCH'
                ? 'bg-highlight-wash text-highlight-ink'
                : accepted
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {STATUS_COPY[status]}
          </span>
        </div>
        <p className="mt-2 text-small text-muted-foreground">{job.description}</p>
        <p className="mt-3 font-mono text-small font-semibold">
          Delivery fee: {formatGhs(job.deliveryFeePesewas)} · {distanceKm.toFixed(1)} km
        </p>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-card p-5">
        <div className="grid gap-1">
          <p className="flex items-center gap-1.5 text-small font-semibold">
            <MapPin aria-hidden className="size-4 text-emerald-700" /> Pickup
          </p>
          <p className="text-small text-muted-foreground">
            {job.store.name}
            {job.store.address ? ` · ${job.store.address}` : ''}
          </p>
          <a
            href={deliveryLocationUrl(job.store.lat, job.store.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-caption font-semibold text-primary underline underline-offset-2"
          >
            Open pickup pin
          </a>
        </div>
        <div className="grid gap-1 border-t border-border pt-3">
          <p className="flex items-center gap-1.5 text-small font-semibold">
            <Navigation aria-hidden className="size-4 text-primary" /> Drop-off
          </p>
          <p className="text-small text-muted-foreground">
            Customer pin · {job.customer.lat.toFixed(5)}, {job.customer.lng.toFixed(5)}
          </p>
          <a
            href={deliveryLocationUrl(job.customer.lat, job.customer.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-caption font-semibold text-primary underline underline-offset-2"
          >
            Open drop-off pin
          </a>
        </div>
        <DeliveryMap
          center={job.store}
          markers={[
            {
              id: 'store',
              lat: job.store.lat,
              lng: job.store.lng,
              label: `${job.store.name} pickup`,
              kind: 'store',
            },
            {
              id: 'customer',
              lat: job.customer.lat,
              lng: job.customer.lng,
              label: 'Customer drop-off',
              kind: 'customer',
            },
          ]}
          connect
        />
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-card p-5">
        {accepted ? (
          <>
            <p className="flex items-center gap-1.5 text-small font-semibold text-emerald-700">
              <Check aria-hidden className="size-4" />
              {status === 'RIDER_ASSIGNED' ? 'Gig accepted — go get it' : STATUS_COPY[status]}
            </p>
            {claimedBy && (
              <p className="text-caption text-muted-foreground">Rider on file: {claimedBy}</p>
            )}
            {directionsUrl && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-small font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Navigation aria-hidden className="size-4" /> Start turn-by-turn navigation
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            )}
          </>
        ) : status === 'NOT_APPLICABLE' ? (
          <p className="text-small text-muted-foreground">
            The shop has not broadcast this delivery yet. Ask the merchant for a fresh link once
            they tap “Broadcast for delivery”.
          </p>
        ) : (
          <>
            <div className="grid gap-2">
              <Label htmlFor="rider-id">Your name / phone</Label>
              <Input
                id="rider-id"
                value={riderId}
                onChange={(event) => setRiderId(event.target.value)}
                placeholder="Kwesi · 024 000 0000"
                className="h-11 rounded-md"
              />
            </div>
            {error && (
              <p role="alert" className="text-small font-medium text-destructive">
                {error}
              </p>
            )}
            <Button
              type="button"
              disabled={busy || riderId.trim().length < 3}
              onClick={() => void accept()}
              className="h-11 rounded-md font-bold"
            >
              {busy ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Check aria-hidden className="size-4" />
              )}
              {busy ? 'Claiming…' : 'Accept delivery gig'}
            </Button>
            <p className="text-caption text-muted-foreground">
              Only one rider can claim this job. If someone else gets there first, the page will
              tell you.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
