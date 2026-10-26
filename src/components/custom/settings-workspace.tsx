// Settings: what an owner comes back to after setup — the social links, the
// storefront address, and pointers to the rest. Socials are optional in
// onboarding, so this screen is where a skipped step gets filled in later.
'use client';

import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  LocateFixed,
  MapPin,
  Save,
  Share2,
  Truck,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DeliveryMap } from '@/components/custom/delivery-map';
import { PushSettings } from '@/components/custom/push-settings';
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
import { SocialAccountList } from '@/lib/contracts/social';
import { StorePayload, type StorePayload as StoreRecord } from '@/lib/contracts/store';
import { deliveryLocationUrl } from '@/lib/delivery';
import { SOCIAL_PLATFORM_DEFS, type SocialPlatformDef } from '@/lib/social';
import { cn } from '@/lib/utils';

type SocialRow = { platform: string; handle: string; url: string };

const emptyRows = () =>
  SOCIAL_PLATFORM_DEFS.map((entry) => ({ platform: entry.value, handle: '', url: '' }));

export function SettingsWorkspace() {
  const [store, setStore] = useState<StoreRecord | null>(null);
  const [rows, setRows] = useState<SocialRow[]>(emptyRows);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [savingPickup, setSavingPickup] = useState(false);
  const [savingDispatch, setSavingDispatch] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pickupError, setPickupError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [storeResult, socialResult] = await Promise.all([
      apiFetch('/api/store', { schema: StorePayload }).catch(() => null),
      apiFetch('/api/store/socials', { schema: SocialAccountList }).catch(() => null),
    ]);
    if (storeResult) {
      setStore(storeResult);
      setPickupAddress(storeResult.address ?? '');
      setPickupLat(storeResult.lat);
      setPickupLng(storeResult.lng);
    }
    if (socialResult) {
      const byPlatform = new Map(socialResult.items.map((item) => [item.platform, item]));
      setRows(
        SOCIAL_PLATFORM_DEFS.map((entry) => {
          const existing = byPlatform.get(entry.value);
          return {
            platform: entry.value,
            handle: existing?.handle ?? '',
            url: existing?.url ?? '',
          };
        }),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const storefrontUrl =
    store && typeof window !== 'undefined'
      ? `${window.location.origin}/store/${store.slug}`
      : store
        ? `/store/${store.slug}`
        : null;

  const connectedCount = rows.filter((row) => row.handle.trim()).length;

  function setField(platform: string, field: 'handle' | 'url', value: string) {
    setRows((current) =>
      current.map((row) => (row.platform === platform ? { ...row, [field]: value } : row)),
    );
  }

  async function copyLink() {
    if (!storefrontUrl) return;
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  }

  async function saveSocials() {
    const accounts = rows
      .filter((row) => row.handle.trim())
      .map((row) => ({
        platform: row.platform,
        handle: row.handle.trim(),
        url: row.url.trim() ? row.url.trim() : null,
      }));
    setSaving(true);
    try {
      await apiFetch('/api/store/socials', {
        method: 'PUT',
        body: JSON.stringify({ accounts }),
        schema: SocialAccountList,
      });
      toast.success(accounts.length > 0 ? 'Socials saved' : 'Socials cleared');
    } catch {
      toast.error('Could not save the socials — check the links are complete URLs');
    } finally {
      setSaving(false);
    }
  }

  function requestPickupLocation() {
    if (!('geolocation' in navigator)) {
      setPickupError('This browser cannot share a location. Drop the pin another way.');
      return;
    }
    setLocating(true);
    setPickupError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPickupLat(position.coords.latitude);
        setPickupLng(position.coords.longitude);
        setLocating(false);
      },
      () => {
        setPickupError('Could not read your location. Allow permission and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  }

  function storeBody(overrides: Record<string, unknown> = {}) {
    if (!store) return null;
    return {
      name: store.name,
      slug: store.slug,
      tagline: store.tagline ?? undefined,
      description: store.description ?? undefined,
      promoBanner: store.promoBanner ?? undefined,
      contactPhone: store.contactPhone ?? undefined,
      address: store.address,
      lat: store.lat,
      lng: store.lng,
      active: store.active,
      theme: store.theme,
      appearance: store.appearance,
      autoDispatch: store.autoDispatch,
      dispatchRadiusKm: store.dispatchRadiusKm,
      ...overrides,
    };
  }

  async function savePickup() {
    if (!store) return;
    setSavingPickup(true);
    setPickupError(null);
    try {
      const updated = await apiFetch('/api/store', {
        method: 'PUT',
        body: JSON.stringify(
          storeBody({
            address: pickupAddress.trim() || null,
            lat: pickupLat,
            lng: pickupLng,
          }),
        ),
        schema: StorePayload,
      });
      setStore(updated);
      toast.success('Pickup location saved');
    } catch {
      toast.error('Could not save the pickup location');
    } finally {
      setSavingPickup(false);
    }
  }

  async function saveDispatch(patch: { autoDispatch?: boolean; dispatchRadiusKm?: number }) {
    if (!store) return;
    setSavingDispatch(true);
    try {
      const updated = await apiFetch('/api/store', {
        method: 'PUT',
        body: JSON.stringify(storeBody(patch)),
        schema: StorePayload,
      });
      setStore(updated);
      toast.success('Dispatch settings saved');
    } catch {
      toast.error('Could not save dispatch settings');
    } finally {
      setSavingDispatch(false);
    }
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
  }

  if (!store) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-small text-muted-foreground">
        Could not load your store settings. Refresh the page to try again.
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <p className="flex items-center gap-1.5 text-eyebrow">
          <Share2 aria-hidden className="size-3.5" /> Settings
        </p>
        <h1 className="mt-1 text-h2 font-display">
          Where customers <span className="text-primary">find you.</span>
        </h1>
        <p className="mt-2 max-w-md text-small text-muted-foreground">
          Your social links, your page address, order alerts, and the account that runs it all.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-h3 font-display">Social links</h2>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              The networks customers already follow. Fill in a handle to connect one — leave the
              rest blank.{' '}
              {connectedCount === 0
                ? 'None connected yet, and that’s fine.'
                : `${connectedCount} connected.`}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {SOCIAL_PLATFORM_DEFS.map((entry: SocialPlatformDef) => {
            const row = rows.find((item) => item.platform === entry.value);
            if (!row) return null;
            const filled = Boolean(row.handle.trim());
            return (
              <div
                key={entry.value}
                className={`grid gap-3 rounded-lg border p-4 ${
                  filled ? 'border-primary/40 bg-primary/[0.04]' : 'border-border'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{entry.label}</p>
                    <p className="text-xs text-muted-foreground">{entry.hint}</p>
                  </div>
                  {filled && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-caption font-semibold text-highlight-ink">
                      <Check aria-hidden className="size-3" /> Connected
                    </span>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`social-${entry.value}-handle`} className="text-caption">
                      Handle
                    </Label>
                    <Input
                      id={`social-${entry.value}-handle`}
                      value={row.handle}
                      onChange={(event) => setField(entry.value, 'handle', event.target.value)}
                      placeholder={entry.value === 'WHATSAPP_STATUS' ? '024 000 0000' : '@handle'}
                      className="h-11 rounded-md"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`social-${entry.value}-url`} className="text-caption">
                      Profile link <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id={`social-${entry.value}-url`}
                      value={row.url}
                      onChange={(event) => setField(entry.value, 'url', event.target.value)}
                      placeholder="https://…"
                      inputMode="url"
                      className="h-11 rounded-md"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={saving}
            onClick={() => void saveSocials()}
            className="h-11 rounded-md px-6 font-semibold"
          >
            {saving ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Save aria-hidden className="size-4" />
            )}
            {saving ? 'Saving…' : 'Save socials'}
          </Button>
          <p className="text-xs text-muted-foreground">
            These appear as contact links on your public page.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 sm:p-7">
        <h2 className="text-h3 font-display">Your page</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The link customers open to browse and order.
        </p>
        {storefrontUrl ? (
          <>
            <p className="mt-4 break-all rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground">
              {storefrontUrl}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void copyLink()}
                className="h-9 rounded-md font-semibold"
              >
                <Copy aria-hidden className="size-4" /> {copied ? 'Copied!' : 'Copy link'}
              </Button>
              <Button asChild variant="outline" className="h-9 rounded-md font-semibold">
                <a href={storefrontUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden className="size-4" /> Open page
                </a>
              </Button>
              <Button asChild variant="ghost" className="h-9 rounded-md font-semibold">
                <Link href="/welcome">
                  Edit logo &amp; banner <ExternalLink aria-hidden className="size-4" />
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-4 text-small text-muted-foreground">
            Finish store setup to publish your link.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-6 sm:p-7">
        <p className="flex items-center gap-1.5 text-eyebrow">
          <MapPin aria-hidden className="size-3.5" /> Fulfillment
        </p>
        <h2 className="mt-1 text-h3 font-display">Pickup &amp; delivery</h2>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">
          Shoppers see your pickup address when they choose pickup. When they choose delivery, the
          platform prices the trip from this pin using straight-line distance.
        </p>
        <div className="mt-5 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pickup-address">Pickup address</Label>
            <Input
              id="pickup-address"
              value={pickupAddress}
              onChange={(event) => setPickupAddress(event.target.value)}
              placeholder="Shop name, street, landmark, city"
              className="h-11 rounded-md"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={requestPickupLocation}
              disabled={locating}
              className="h-9 rounded-md font-semibold"
            >
              {locating ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <LocateFixed aria-hidden className="size-4" />
              )}
              {locating ? 'Finding you…' : 'Use my current location'}
            </Button>
            {pickupLat != null && pickupLng != null && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPickupLat(null);
                    setPickupLng(null);
                  }}
                  className="h-9 rounded-md font-semibold"
                >
                  Clear pin
                </Button>
                <a
                  href={deliveryLocationUrl(pickupLat, pickupLng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-small font-semibold text-primary underline underline-offset-2"
                >
                  Open in maps
                </a>
              </>
            )}
          </div>
          {pickupError && (
            <p role="alert" className="text-small font-medium text-destructive">
              {pickupError}
            </p>
          )}
          {pickupLat != null && pickupLng != null ? (
            <div className="grid gap-2">
              <DeliveryMap
                center={{ lat: pickupLat, lng: pickupLng }}
                markers={[
                  {
                    id: 'pickup',
                    lat: pickupLat,
                    lng: pickupLng,
                    label: 'Shop pickup pin',
                    kind: 'pickup',
                    draggable: true,
                  },
                ]}
                onMarkerMove={(_id, coordinates) => {
                  setPickupLat(coordinates.lat);
                  setPickupLng(coordinates.lng);
                }}
              />
              <p className="text-caption text-muted-foreground">
                Drag the pin to your exact shop entrance.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-small text-muted-foreground">
              No pin yet. Local delivery stays unavailable until you set one.
            </div>
          )}
          <Button
            type="button"
            disabled={savingPickup}
            onClick={() => void savePickup()}
            className="h-11 w-fit rounded-md px-6 font-semibold"
          >
            {savingPickup ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Save aria-hidden className="size-4" />
            )}
            {savingPickup ? 'Saving…' : 'Save pickup location'}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 sm:p-7">
        <p className="flex items-center gap-1.5 text-eyebrow">
          <Truck aria-hidden className="size-3.5" /> Dispatch
        </p>
        <h2 className="mt-1 text-h3 font-display">Automatic delivery dispatch</h2>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">
          New local-delivery orders go straight to your approved crew members who are on shift. Turn
          this off if you prefer to send every order yourself.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
          <div>
            <Label htmlFor="settings-auto-dispatch" className="font-semibold">
              Send new deliveries automatically
            </Label>
            <p className="mt-0.5 text-small text-muted-foreground">
              {store.autoDispatch
                ? 'On. Orders wait in the delivery desk if no rider is on shift.'
                : 'Off. Send each delivery from the orders page or delivery desk.'}
            </p>
          </div>
          <button
            id="settings-auto-dispatch"
            type="button"
            role="switch"
            aria-checked={store.autoDispatch}
            onClick={() => void saveDispatch({ autoDispatch: !store.autoDispatch })}
            disabled={savingDispatch}
            className={cn(
              'relative h-6 w-11 rounded-full border transition-colors disabled:opacity-60',
              store.autoDispatch ? 'border-primary bg-primary' : 'border-border bg-muted',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform',
                store.autoDispatch ? 'translate-x-5' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
          <div>
            <Label htmlFor="settings-dispatch-radius" className="font-semibold">
              First search radius
            </Label>
            <p className="mt-0.5 text-small text-muted-foreground">
              Riders outside this ring wait for the wider retry.
            </p>
          </div>
          <Select
            value={String(store.dispatchRadiusKm)}
            onValueChange={(value) => void saveDispatch({ dispatchRadiusKm: Number(value) })}
            disabled={savingDispatch}
          >
            <SelectTrigger id="settings-dispatch-radius" className="w-36">
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

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" className="h-10 rounded-md font-semibold">
            <Link href="/dashboard/delivery">
              <Truck aria-hidden className="size-4" /> Manage riders &amp; waiting jobs
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Riders must be approved and tap &quot;Go on shift&quot; before jobs arrive.
          </p>
        </div>
      </section>

      <PushSettings />

      <section className="rounded-lg border border-border bg-card p-6 sm:p-7">
        <h2 className="text-h3 font-display">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your name, phone, password and profile picture.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline" className="h-10 rounded-md font-semibold">
            <Link href="/profile">
              <UserRound aria-hidden className="size-4" /> Manage account
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
