'use client';

import { Loader2, ShieldCheck, Truck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TilzaLogo } from '@/components/custom/tilza-logo';
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
  CourierInviteInfo,
  type CourierJoinInput,
  CourierVehicleType,
  type CourierInviteInfo as InviteInfo,
} from '@/lib/contracts/courier';

const vehicleLabels: Record<CourierJoinInput['vehicleType'], string> = {
  MOTORBIKE: 'Motorbike',
  TRICYCLE: 'Tricycle',
  CAR: 'Car',
  BICYCLE: 'Bicycle',
  WALKING: 'Walking',
};

export function CourierJoinForm({ token }: { token: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState<CourierJoinInput['vehicleType']>('MOTORBIKE');
  const [plateNumber, setPlateNumber] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/public/courier/invite/${encodeURIComponent(token)}`, {
      schema: CourierInviteInfo,
      cache: 'no-store',
    })
      .then((result) => {
        if (active) setInvite(result);
      })
      .catch(() => {
        if (active) setLoadError('This crew link is no longer active. Ask the shop for a new one.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/public/courier/invite/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          vehicleType,
          plateNumber: plateNumber || undefined,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        status?: string;
        storeName?: string;
        errors?: Record<string, string>;
        error?: string;
      } | null;
      if (!response.ok) {
        const first = body?.errors ? Object.values(body.errors)[0] : body?.error;
        setFieldError(first ?? 'Could not join this crew. Check your details.');
        return;
      }
      toast.success(
        body?.status === 'ACTIVE'
          ? `You are already approved for ${body.storeName ?? 'this shop'}`
          : `Application sent to ${body?.storeName ?? 'the shop'}. They will approve you shortly.`,
      );
      router.replace('/courier');
    } catch {
      setFieldError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[70dvh] place-items-center px-4">
        <Loader2 aria-hidden className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !invite) {
    return (
      <div className="mx-auto grid min-h-[70dvh] max-w-md place-items-center px-4">
        <div className="w-full rounded-xl border border-border bg-card p-6 text-center">
          <Truck aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-3 font-display text-h3">Crew link not active</h1>
          <p className="mt-2 text-small text-muted-foreground">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid min-h-[70dvh] w-full max-w-md place-items-center px-4 py-10">
      <div className="w-full rounded-xl border border-border bg-card p-6">
        <TilzaLogo className="mb-5 text-xl" />
        <p className="flex items-center gap-1.5 text-eyebrow">
          <Truck aria-hidden className="size-3.5" /> {invite.storeName}
        </p>
        <h1 className="mt-1 font-display text-h2">Join the delivery crew</h1>
        <p className="mt-1 text-small text-muted-foreground">
          The shop will review your details before you can receive jobs.
        </p>

        <form onSubmit={submit} className="mt-5 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="courier-name">Full name</Label>
            <Input
              id="courier-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              placeholder="Ama Mensah"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="courier-phone">Phone number</Label>
            <Input
              id="courier-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder="024 123 4567"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="courier-vehicle">Vehicle</Label>
            <Select
              value={vehicleType}
              onValueChange={(value) => setVehicleType(CourierVehicleType.parse(value))}
            >
              <SelectTrigger id="courier-vehicle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CourierVehicleType.options.map((value) => (
                  <SelectItem key={value} value={value}>
                    {vehicleLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="courier-plate">Plate number (optional)</Label>
            <Input
              id="courier-plate"
              value={plateNumber}
              onChange={(event) => setPlateNumber(event.target.value)}
              maxLength={24}
              placeholder="GT 1234-24"
            />
          </div>

          {fieldError && (
            <p role="alert" className="text-caption font-medium text-destructive">
              {fieldError}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="h-11 font-semibold">
            {submitting ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <ShieldCheck aria-hidden className="size-4" />
            )}
            Join crew
          </Button>
        </form>
        <p className="mt-4 text-center text-caption text-muted-foreground">
          Link expires {new Date(invite.expiresAt).toLocaleDateString()}.
        </p>
      </div>
    </div>
  );
}
