'use client';

import {
  BadgeCheck,
  Camera,
  Check,
  Copy,
  Link2,
  Loader2,
  Phone,
  Radio,
  RefreshCcw,
  ShieldCheck,
  Truck,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-client';
import {
  CrewDeliveryList,
  CrewInviteResult,
  type CrewMember,
  CrewOverview,
  type CrewOverview as CrewOverviewValue,
  DispatchResult,
  type MerchantDelivery,
} from '@/lib/contracts/courier';
import { cn } from '@/lib/utils';

const statusStyles = {
  PENDING: 'bg-highlight-wash text-highlight-ink',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  SUSPENDED: 'bg-destructive/10 text-destructive',
} as const;

const statusLabels = {
  PENDING: 'Needs approval',
  ACTIVE: 'Approved',
  SUSPENDED: 'Suspended',
} as const;

const vehicleLabels: Record<string, string> = {
  MOTORBIKE: 'Motorbike',
  TRICYCLE: 'Tricycle',
  CAR: 'Car',
  BICYCLE: 'Bicycle',
  WALKING: 'Walking',
};

const deliveryStatusLabels: Record<string, string> = {
  PENDING_DISPATCH: 'Waiting for a rider',
  RIDER_ASSIGNED: 'Rider assigned',
  IN_TRANSIT: 'On the way',
  DELIVERED: 'Delivered',
};

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DeliveryCrewWorkspace() {
  const [overview, setOverview] = useState<CrewOverviewValue | null>(null);
  const [deliveries, setDeliveries] = useState<MerchantDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [nextOverview, nextDeliveries] = await Promise.all([
        apiFetch('/api/courier/crew', { schema: CrewOverview }),
        apiFetch('/api/courier/crew/deliveries', { schema: CrewDeliveryList }).catch(() => null),
      ]);
      setOverview(nextOverview);
      if (nextDeliveries) setDeliveries(nextDeliveries.items);
    } catch {
      if (!silent) toast.error('Could not load your delivery crew.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function copyInvite() {
    if (!overview?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(overview.inviteUrl);
      setCopied(true);
      toast.success('Crew link copied');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Copy failed — select the link and copy it manually.');
    }
  }

  async function rotateInvite() {
    setBusy('rotate');
    try {
      const result = await apiFetch('/api/courier/crew/invite', {
        method: 'POST',
        schema: CrewInviteResult,
      });
      setOverview((current) =>
        current
          ? { ...current, inviteUrl: result.url, inviteExpiresAt: result.expiresAt }
          : current,
      );
      toast.success('New crew link created. The old link no longer works.');
    } catch {
      toast.error('Could not create a new crew link.');
    } finally {
      setBusy(null);
    }
  }

  async function updateMember(member: CrewMember, status: 'ACTIVE' | 'SUSPENDED') {
    setBusy(member.membershipId);
    try {
      await apiFetch<{ ok: boolean; status: string }>(`/api/courier/crew/${member.membershipId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setOverview((current) =>
        current
          ? {
              ...current,
              members: current.members.map((item) =>
                item.membershipId === member.membershipId
                  ? { ...item, status, isOnline: status === 'ACTIVE' ? item.isOnline : false }
                  : item,
              ),
              pendingCount:
                member.status === 'PENDING' && status === 'ACTIVE'
                  ? Math.max(0, current.pendingCount - 1)
                  : current.pendingCount,
            }
          : current,
      );
      toast.success(
        status === 'ACTIVE' ? `${member.name} can now receive jobs` : `${member.name} suspended`,
      );
    } catch {
      toast.error('Could not update this rider.');
    } finally {
      setBusy(null);
    }
  }

  async function updateSettings(patch: { autoDispatch?: boolean; dispatchRadiusKm?: number }) {
    if (!overview) return;
    setBusy('settings');
    const previous = overview;
    setOverview({ ...overview, ...patch });
    try {
      await apiFetch('/api/courier/crew/settings', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    } catch {
      setOverview(previous);
      toast.error('Could not save dispatch settings.');
    } finally {
      setBusy(null);
    }
  }

  async function dispatchDelivery(delivery: MerchantDelivery) {
    setBusy(`dispatch:${delivery.orderId}`);
    try {
      const result = await apiFetch(`/api/orders/${delivery.orderId}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({}),
        schema: DispatchResult,
      });
      if (result.offers > 0) {
        toast.success(
          `Sent to ${result.offers} rider${result.offers === 1 ? '' : 's'} within ${result.radiusKm} km.`,
        );
      } else if (result.onlineCouriers === 0) {
        toast.warning('No rider is on shift yet. The order stays here for a manual retry.');
      } else {
        toast.warning(
          `No rider within ${result.radiusKm} km. Widen the radius or wait for a rider to come on shift.`,
        );
      }
      await load(true);
    } catch {
      toast.error('Could not send this delivery to the crew.');
    } finally {
      setBusy(null);
    }
  }

  async function verifyDelivery(delivery: MerchantDelivery) {
    setBusy(`verify:${delivery.orderId}`);
    try {
      await apiFetch(`/api/orders/${delivery.orderId}/verify-delivery`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setDeliveries((current) =>
        current.map((item) =>
          item.orderId === delivery.orderId
            ? { ...item, merchantVerifiedAt: new Date().toISOString() }
            : item,
        ),
      );
      toast.success(`${delivery.orderNumber} verified`);
    } catch {
      toast.error('Could not verify this delivery.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4">
        <div className="h-28 animate-pulse rounded-xl border border-border bg-muted/40" />
        <div className="h-56 animate-pulse rounded-xl border border-border bg-muted/40" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-small text-muted-foreground">
        Could not load your delivery crew. Refresh the page to try again.
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-eyebrow">Last mile</p>
          <h1 className="mt-1 font-display text-h2">Delivery crew</h1>
          <p className="mt-1 max-w-xl text-small text-muted-foreground">
            Approved riders get nearby jobs on their phone. Nothing is public — every rider joins
            through your link and waits for your approval.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={busy !== null}
          className="font-semibold"
        >
          <RefreshCcw aria-hidden className="size-4" />
          Refresh
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-eyebrow">Crew</p>
          <p className="mt-1 font-display text-h3">{overview.members.length}</p>
          <p className="text-caption text-muted-foreground">riders in your crew</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-eyebrow">On shift</p>
          <p className="mt-1 font-display text-h3">{overview.onlineCount}</p>
          <p className="text-caption text-muted-foreground">ready for nearby jobs</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-eyebrow">Waiting</p>
          <p className="mt-1 font-display text-h3">{overview.pendingCount}</p>
          <p className="text-caption text-muted-foreground">need your approval</p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Link2 aria-hidden className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-h3">Crew invite link</h2>
            <p className="mt-0.5 text-small text-muted-foreground">
              Drop this in your rider group. They sign up on their phone; you approve each one.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                readOnly
                value={overview.inviteUrl ?? ''}
                aria-label="Crew invite link"
                className="min-w-0 flex-1 font-mono text-caption"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button type="button" onClick={() => void copyInvite()} className="font-semibold">
                {copied ? (
                  <Check aria-hidden className="size-4" />
                ) : (
                  <Copy aria-hidden className="size-4" />
                )}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
              <span>{new Date(overview.inviteExpiresAt ?? Date.now()).toLocaleDateString()}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void rotateInvite()}
                disabled={busy !== null}
                className="h-7 px-2 text-caption font-semibold"
              >
                {busy === 'rotate' && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
                Make a new link
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-h3">
          <Truck aria-hidden className="size-4" /> Dispatch
        </h2>
        <div className="mt-4 grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Label htmlFor="auto-dispatch" className="font-semibold">
                Send new deliveries automatically
              </Label>
              <p className="mt-0.5 text-small text-muted-foreground">
                New local-delivery orders go straight to on-shift riders nearby.
              </p>
            </div>
            <button
              id="auto-dispatch"
              type="button"
              role="switch"
              aria-checked={overview.autoDispatch}
              onClick={() => void updateSettings({ autoDispatch: !overview.autoDispatch })}
              disabled={busy !== null}
              className={cn(
                'relative h-6 w-11 rounded-full border transition-colors',
                overview.autoDispatch ? 'border-primary bg-primary' : 'border-border bg-muted',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform',
                  overview.autoDispatch ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>
          {overview.autoDispatch && overview.onlineCount === 0 && (
            <p className="rounded-lg border border-highlight-ink/20 bg-highlight-wash px-3 py-2 text-caption font-medium text-highlight-ink">
              Auto-send is on, but no rider is on shift. New orders wait below until a rider goes on
              shift or you send them manually.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div>
              <Label htmlFor="dispatch-radius" className="font-semibold">
                First search radius
              </Label>
              <p className="mt-0.5 text-small text-muted-foreground">
                Riders outside this ring do not get the first offer.
              </p>
            </div>
            <Select
              value={String(overview.dispatchRadiusKm)}
              onValueChange={(value) => void updateSettings({ dispatchRadiusKm: Number(value) })}
              disabled={busy !== null}
            >
              <SelectTrigger id="dispatch-radius" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 8, 10, 15].map((radius) => (
                  <SelectItem key={radius} value={String(radius)}>
                    {radius} km
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {deliveries.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-h3">
              <Truck aria-hidden className="size-4" /> Deliveries &amp; waiting jobs
            </h2>
            <Badge variant="neutral">{deliveries.length} recent</Badge>
          </div>
          <ul className="mt-4 grid gap-2">
            {deliveries.map((delivery) => (
              <li key={delivery.orderId} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-caption font-semibold text-primary">
                      {delivery.orderNumber}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-medium">
                      {deliveryStatusLabels[delivery.deliveryStatus] ?? delivery.deliveryStatus}
                    </span>
                    {delivery.merchantVerifiedAt && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-caption font-semibold text-emerald-700">
                        <BadgeCheck aria-hidden className="size-3.5" /> Verified
                      </span>
                    )}
                    {delivery.buyerConfirmedAt && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium text-highlight-ink">
                        Buyer confirmed
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {delivery.deliveryStatus === 'PENDING_DISPATCH' && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void dispatchDelivery(delivery)}
                        disabled={busy !== null}
                        className="h-8 font-semibold"
                      >
                        {busy === `dispatch:${delivery.orderId}` ? (
                          <Loader2 aria-hidden className="size-3.5 animate-spin" />
                        ) : (
                          <Radio aria-hidden className="size-3.5" />
                        )}
                        Send to crew
                      </Button>
                    )}
                    {delivery.proofUrl && (
                      <Button asChild size="sm" variant="outline" className="h-8 font-semibold">
                        <a href={delivery.proofUrl} target="_blank" rel="noopener noreferrer">
                          <Camera aria-hidden className="size-3.5" /> Handover photo
                        </a>
                      </Button>
                    )}
                    {delivery.deliveryStatus === 'DELIVERED' && !delivery.merchantVerifiedAt && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void verifyDelivery(delivery)}
                        disabled={busy !== null}
                        className="h-8 font-semibold"
                      >
                        {busy === `verify:${delivery.orderId}` ? (
                          <Loader2 aria-hidden className="size-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck aria-hidden className="size-3.5" />
                        )}
                        Verify handover
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
                  {delivery.courierName ? (
                    <span>
                      {delivery.courierName}{' '}
                      {delivery.courierPhone && (
                        <a
                          href={`tel:${delivery.courierPhone}`}
                          className="inline-flex items-center gap-1 font-semibold text-primary"
                        >
                          <Phone aria-hidden className="size-3" /> Call
                        </a>
                      )}
                    </span>
                  ) : (
                    <span>No rider yet</span>
                  )}
                  {delivery.handoffCode && <span>Handoff {delivery.handoffCode}</span>}
                  {delivery.deliveredAt && (
                    <span>Delivered {formatWhen(delivery.deliveredAt)}</span>
                  )}
                  {delivery.proofConsent && <span>Photo gallery consent</span>}
                  {delivery.handoffCodeUsedAt && <span>Code used</span>}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-caption text-muted-foreground">
            Verifying records the shop-side handover separately from the buyer&apos;s confirmation.
            The photo stays private unless the buyer opted in.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-h3">
            <ShieldCheck aria-hidden className="size-4" /> Your riders
          </h2>
          <Badge variant="neutral">{overview.members.length} total</Badge>
        </div>
        {overview.members.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border p-5 text-small text-muted-foreground">
            No applications yet. Share the crew link with your riders to get started.
          </div>
        ) : (
          <ul className="mt-4 grid gap-2">
            {overview.members.map((member) => (
              <li
                key={member.membershipId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-highlight font-display text-small font-bold text-highlight-foreground">
                    {member.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-small font-semibold">{member.name}</p>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[0.65rem] font-semibold',
                          statusStyles[member.status],
                        )}
                      >
                        {statusLabels[member.status]}
                      </span>
                    </div>
                    <p className="truncate text-caption text-muted-foreground">
                      {member.phone} · {vehicleLabels[member.vehicleType] ?? member.vehicleType}
                      {member.plateNumber ? ` · ${member.plateNumber}` : ''} · {member.deliveries}{' '}
                      delivered
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-caption font-medium',
                      member.isOnline ? 'text-emerald-700' : 'text-muted-foreground',
                    )}
                  >
                    <Radio aria-hidden className="size-3.5" />
                    {member.isOnline ? 'On shift' : 'Off shift'}
                  </span>
                  {member.status === 'ACTIVE' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void updateMember(member, 'SUSPENDED')}
                      disabled={busy !== null}
                      className="font-semibold"
                    >
                      <UserX aria-hidden className="size-4" />
                      Suspend
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void updateMember(member, 'ACTIVE')}
                      disabled={busy !== null}
                      className="font-semibold"
                    >
                      {busy === member.membershipId ? (
                        <Loader2 aria-hidden className="size-4 animate-spin" />
                      ) : (
                        <UserCheck aria-hidden className="size-4" />
                      )}
                      Approve
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
