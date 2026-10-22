'use client';

import {
  Bell,
  BellOff,
  CheckCircle2,
  Loader2,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  Radio,
  RefreshCcw,
  ShieldAlert,
  Truck,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import {
  CourierAcceptResult,
  type CourierJob,
  CourierJobs,
  type CourierJobs as CourierJobsValue,
  CourierMe,
  type CourierMe as CourierMeValue,
  CourierStatusResult,
} from '@/lib/contracts/courier';
import { formatGhs } from '@/lib/contracts/order';
import {
  type SimplePushConfig as PushConfigValue,
  SimplePushConfig,
} from '@/lib/contracts/simple-push';
import { deliveryDirectionsUrl, deliveryLocationUrl } from '@/lib/delivery';
import { waMessageLink } from '@/lib/phone';
import { subscribeToPush, unsubscribeFromPush } from '@/lib/push-client';
import { cn } from '@/lib/utils';

function JobStatus({ job }: { job: CourierJob }) {
  if (job.deliveryStatus === 'RIDER_ASSIGNED') {
    return (
      <span className="rounded-full bg-highlight-wash px-2.5 py-1 text-caption font-semibold text-highlight-ink">
        Accepted â€” pick up
      </span>
    );
  }
  if (job.deliveryStatus === 'IN_TRANSIT') {
    return (
      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-caption font-semibold text-highlight-ink">
        On the way
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-caption font-semibold text-emerald-700">
      Delivered
    </span>
  );
}

export function CourierWorkspace() {
  const [me, setMe] = useState<CourierMeValue | null>(null);
  const [jobs, setJobs] = useState<CourierJobsValue>({ offers: [], active: [] });
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pushConfig, setPushConfig] = useState<PushConfigValue | null>(null);
  const [pushOn, setPushOn] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const result = await apiFetch('/api/courier/me', {
        schema: CourierMe,
        cache: 'no-store',
      });
      setMe(result);
      setUnauthorized(false);
      return result;
    } catch {
      setUnauthorized(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadJobs = useCallback(async (silent = false) => {
    try {
      setJobs(await apiFetch('/api/courier/jobs', { schema: CourierJobs, cache: 'no-store' }));
    } catch {
      if (!silent) toast.error('Could not load your jobs.');
    }
  }, []);

  useEffect(() => {
    void loadMe().then((result) => {
      if (result?.memberships.some((membership) => membership.status === 'ACTIVE')) {
        void loadJobs();
      }
    });
    apiFetch('/api/courier/push', { schema: SimplePushConfig })
      .then((config) => {
        setPushConfig(config);
        setPushOn(config.subscribed);
      })
      .catch(() => undefined);
  }, [loadJobs, loadMe]);

  const approved = me?.memberships.some((membership) => membership.status === 'ACTIVE') ?? false;

  useEffect(() => {
    if (!approved) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadJobs(true);
    }, 10_000);
    const onFocus = () => void loadJobs(true);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [approved, loadJobs]);

  useEffect(() => {
    if (!me?.isOnline) return;
    const ping = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          void apiFetch('/api/courier/location', {
            method: 'POST',
            body: JSON.stringify({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              isOnline: true,
            }),
          }).catch(() => undefined);
        },
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 },
      );
    };
    ping();
    const timer = window.setInterval(ping, 45_000);
    return () => window.clearInterval(timer);
  }, [me?.isOnline]);

  async function toggleShift() {
    if (!me) return;
    if (me.isOnline) {
      setBusy('shift');
      try {
        await apiFetch('/api/courier/presence', {
          method: 'POST',
          body: JSON.stringify({ isOnline: false }),
        });
        setMe({ ...me, isOnline: false });
        toast.success('You are off shift');
      } catch {
        toast.error('Could not go off shift.');
      } finally {
        setBusy(null);
      }
      return;
    }

    if (!navigator.geolocation) {
      toast.error('This phone cannot share a location.');
      return;
    }
    setBusy('shift');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await apiFetch('/api/courier/location', {
            method: 'POST',
            body: JSON.stringify({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              isOnline: true,
            }),
          });
          setMe({ ...me, isOnline: true });
          toast.success('You are on shift â€” nearby jobs can reach you');
        } catch {
          toast.error('Could not go on shift. Check location permission.');
        } finally {
          setBusy(null);
        }
      },
      () => {
        setBusy(null);
        toast.error('Allow location access to receive nearby jobs.');
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
  }

  async function accept(job: CourierJob) {
    setBusy(`accept-${job.orderId}`);
    try {
      await apiFetch(`/api/courier/jobs/${job.orderId}/accept`, {
        method: 'POST',
        schema: CourierAcceptResult,
      });
      toast.success('Job accepted â€” head to the shop');
      await loadJobs();
    } catch {
      toast.error('Another rider may have taken this job.');
      await loadJobs(true);
    } finally {
      setBusy(null);
    }
  }

  async function decline(job: CourierJob) {
    setBusy(`decline-${job.orderId}`);
    try {
      await apiFetch(`/api/courier/jobs/${job.orderId}/decline`, { method: 'POST' });
      setJobs((current) => ({
        ...current,
        offers: current.offers.filter((offer) => offer.orderId !== job.orderId),
      }));
    } catch {
      toast.error('Could not decline this job.');
    } finally {
      setBusy(null);
    }
  }

  async function advance(job: CourierJob, status: 'IN_TRANSIT' | 'DELIVERED') {
    if (
      status === 'DELIVERED' &&
      !window.confirm(
        'Confirm the buyer has the order in hand? They will then confirm with a photo.',
      )
    ) {
      return;
    }
    setBusy(`status-${job.orderId}`);
    try {
      await apiFetch(`/api/courier/jobs/${job.orderId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
        schema: CourierStatusResult,
      });
      toast.success(status === 'DELIVERED' ? 'Marked delivered' : 'Marked picked up');
      await loadJobs();
    } catch {
      toast.error('Could not update this job.');
    } finally {
      setBusy(null);
    }
  }

  async function enablePush() {
    if (!pushConfig?.publicKey) return;
    setBusy('push');
    try {
      const error = await subscribeToPush(pushConfig.publicKey, '/api/courier/push');
      if (error) {
        toast.error(error);
        return;
      }
      setPushOn(true);
      toast.success('Job alerts are on for this phone');
    } catch {
      toast.error('Could not turn on job alerts.');
    } finally {
      setBusy(null);
    }
  }

  async function disablePush() {
    setBusy('push');
    try {
      await unsubscribeFromPush('/api/courier/push');
      setPushOn(false);
      toast.success('Job alerts are off for this phone');
    } catch {
      toast.error('Could not turn off job alerts.');
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    await apiFetch('/api/courier/logout', { method: 'POST' }).catch(() => undefined);
    setMe(null);
    setUnauthorized(true);
  }

  if (loading) {
    return (
      <div className="grid min-h-[70dvh] place-items-center px-4">
        <Loader2 aria-hidden className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (unauthorized || !me) {
    return (
      <div className="mx-auto grid min-h-[70dvh] max-w-md place-items-center px-4">
        <div className="w-full rounded-xl border border-border bg-card p-6 text-center">
          <Truck aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-3 font-display text-h3">Open your crew link</h1>
          <p className="mt-2 text-small text-muted-foreground">
            This phone is not signed in. Use the invite link the shop sent to your rider group.
          </p>
        </div>
      </div>
    );
  }

  const pending = me.memberships.filter((membership) => membership.status === 'PENDING');
  const suspended = me.memberships.filter((membership) => membership.status === 'SUSPENDED');

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-6 sm:py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-eyebrow">Tilza courier</p>
          <h1 className="mt-1 font-display text-h2">Hi, {me.name.split(' ')[0]}</h1>
          <p className="mt-1 text-small text-muted-foreground">
            {me.vehicleType.toLowerCase()}
            {me.plateNumber ? ` Â· ${me.plateNumber}` : ''} Â· {me.phone}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pushConfig?.configured && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void (pushOn ? disablePush() : enablePush())}
              disabled={busy !== null}
              aria-label={pushOn ? 'Turn off job alerts' : 'Turn on job alerts'}
            >
              {busy === 'push' ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : pushOn ? (
                <Bell aria-hidden className="size-4" />
              ) : (
                <BellOff aria-hidden className="size-4" />
              )}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void logout()}
            aria-label="Sign out"
          >
            <LogOut aria-hidden className="size-4" />
          </Button>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'grid size-11 place-items-center rounded-full',
                me.isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground',
              )}
            >
              <Radio aria-hidden className="size-5" />
            </span>
            <div>
              <p className="font-semibold">{me.isOnline ? 'On shift' : 'Off shift'}</p>
              <p className="text-small text-muted-foreground">
                {me.isOnline
                  ? 'Nearby approved jobs can reach this phone.'
                  : 'Go on shift to receive nearby delivery offers.'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void toggleShift()}
            disabled={busy !== null || !approved}
            className="h-10 font-semibold"
          >
            {busy === 'shift' && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {me.isOnline ? 'Go off shift' : 'Go on shift'}
          </Button>
        </div>
        {!approved && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-highlight-wash p-3 text-caption text-highlight-ink">
            <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              {pending.length > 0
                ? 'Your application is waiting for the shop to approve you.'
                : suspended.length > 0
                  ? 'Your crew access is suspended. Contact the shop.'
                  : 'Join a shop crew first.'}
            </span>
          </div>
        )}
      </section>

      {pending.length > 0 && approved && (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-caption text-muted-foreground">
          Waiting for approval: {pending.map((membership) => membership.storeName).join(', ')}
        </p>
      )}

      {jobs.offers.length > 0 && (
        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-h3">Nearby jobs</h2>
            <Badge variant="neutral">{jobs.offers.length} new</Badge>
          </div>
          {jobs.offers.map((job) => (
            <article key={job.orderId} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-eyebrow">{job.storeName}</p>
                  <h3 className="mt-0.5 font-display text-h4">#{job.orderNumber}</h3>
                  <p className="mt-1 line-clamp-2 text-small text-muted-foreground">
                    {job.description}
                  </p>
                </div>
                <p className="font-mono text-h4">{formatGhs(job.deliveryFeePesewas)}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-caption text-muted-foreground">
                {job.distanceKm != null && <span>{job.distanceKm.toFixed(1)} km away</span>}
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden className="size-3.5" /> {job.storeAddress ?? 'Shop pickup'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void accept(job)}
                  disabled={busy !== null}
                  className="font-semibold"
                >
                  {busy === `accept-${job.orderId}` ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 aria-hidden className="size-4" />
                  )}
                  Accept job
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void decline(job)}
                  disabled={busy !== null}
                  className="font-semibold"
                >
                  <X aria-hidden className="size-4" /> Not now
                </Button>
                <Button asChild variant="ghost" className="font-semibold">
                  <a
                    href={deliveryLocationUrl(job.storeLat, job.storeLng)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation aria-hidden className="size-4" /> Shop map
                  </a>
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-h3">My deliveries</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void loadJobs()}
            disabled={busy !== null}
            className="font-semibold"
          >
            <RefreshCcw aria-hidden className="size-4" /> Refresh
          </Button>
        </div>
        {jobs.active.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-small text-muted-foreground">
            No active delivery right now.
          </div>
        ) : (
          jobs.active.map((job) => {
            const directions =
              job.customerLat != null && job.customerLng != null
                ? deliveryDirectionsUrl(
                    job.storeLat,
                    job.storeLng,
                    job.customerLat,
                    job.customerLng,
                  )
                : deliveryLocationUrl(job.storeLat, job.storeLng);
            const whatsapp = waMessageLink(
              job.customerPhone,
              `Hi ${job.customerName ?? 'there'}, I'm your Tilza rider for #${job.orderNumber}.`,
            );
            return (
              <article key={job.orderId} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-eyebrow">{job.storeName}</p>
                    <h3 className="mt-0.5 font-display text-h4">#{job.orderNumber}</h3>
                    <p className="mt-1 text-small text-muted-foreground">{job.description}</p>
                  </div>
                  <JobStatus job={job} />
                </div>

                {job.customerName && (
                  <div className="mt-3 rounded-lg bg-muted/50 p-3">
                    <p className="text-small font-semibold">{job.customerName}</p>
                    <p className="text-caption text-muted-foreground">
                      {job.customerPhone ?? 'No phone'}
                    </p>
                  </div>
                )}

                {job.handoffCode && job.deliveryStatus !== 'DELIVERED' && (
                  <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-caption font-semibold text-primary">Handoff code</p>
                    <p className="mt-1 font-mono text-h2 tracking-[0.2em]">{job.handoffCode}</p>
                    <p className="mt-1 text-caption text-muted-foreground">
                      Ask the buyer for this code at the door. Do not share it before arrival.
                    </p>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild className="font-semibold">
                    <a href={directions} target="_blank" rel="noopener noreferrer">
                      <Navigation aria-hidden className="size-4" /> Directions
                    </a>
                  </Button>
                  {job.customerPhone && (
                    <Button asChild variant="outline" className="font-semibold">
                      <a href={`tel:${job.customerPhone}`}>
                        <Phone aria-hidden className="size-4" /> Call buyer
                      </a>
                    </Button>
                  )}
                  {whatsapp && (
                    <Button asChild variant="outline" className="font-semibold">
                      <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                        WhatsApp
                      </a>
                    </Button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  {job.deliveryStatus === 'RIDER_ASSIGNED' && (
                    <Button
                      type="button"
                      onClick={() => void advance(job, 'IN_TRANSIT')}
                      disabled={busy !== null}
                      className="font-semibold"
                    >
                      {busy === `status-${job.orderId}` && (
                        <Loader2 aria-hidden className="size-4 animate-spin" />
                      )}
                      Picked up
                    </Button>
                  )}
                  {job.deliveryStatus === 'IN_TRANSIT' && (
                    <Button
                      type="button"
                      onClick={() => void advance(job, 'DELIVERED')}
                      disabled={busy !== null}
                      className="font-semibold"
                    >
                      {busy === `status-${job.orderId}` && (
                        <Loader2 aria-hidden className="size-4 animate-spin" />
                      )}
                      Mark delivered
                    </Button>
                  )}
                  {job.deliveryStatus === 'DELIVERED' && (
                    <p className="text-caption text-muted-foreground">
                      Delivered. The buyer now confirms with the handoff code and a photo.
                    </p>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>

      <p className="pb-4 text-center text-caption text-muted-foreground">
        {me.memberships
          .filter((membership) => membership.status === 'ACTIVE')
          .map((membership) => membership.storeName)
          .join(' Â· ')}
      </p>
    </div>
  );
}
