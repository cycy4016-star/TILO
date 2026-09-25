// Storefront visitor capture: "leave your details" with a consent opt-in.
// Submissions land straight in the owner's customers list and ring the bell.
'use client';

import { Check, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { PublicLeadCreate, PublicLeadResult } from '@/lib/contracts/public-store';

export function LeadCaptureCard({ storeName, slug }: { storeName: string; slug: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [town, setTown] = useState('');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!consent) {
      setError('Tick the box to save your details');
      return;
    }
    const parsed = PublicLeadCreate.safeParse({ name, phone, town, note, consent: true });
    if (!parsed.success) {
      const messages = Object.values(parsed.error.flatten().fieldErrors).flat();
      setError(messages[0] ?? 'Check the details and try again');
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/public/store/${slug}/leads`, {
        method: 'POST',
        body: JSON.stringify(parsed.data),
        schema: PublicLeadResult,
      });
      setDone(true);
      toast.success('Details saved');
    } catch (requestError) {
      const cause = (
        requestError as { cause?: { error?: string; errors?: Record<string, string> } }
      ).cause;
      setError(
        cause?.error ?? Object.values(cause?.errors ?? {})[0] ?? 'Could not save your details',
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="mt-8 rounded-xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Check aria-hidden className="size-6" />
        </span>
        <p className="mt-3 text-xl font-bold">You&apos;re on the list</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {storeName} has your details now. Order anytime — by WhatsApp, SMS or right here.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <p className="flex items-center gap-2 text-lg font-bold">
        <Sparkles aria-hidden className="size-4 text-primary" />
        Leave your details
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Share your WhatsApp number so {storeName} can confirm orders quickly and keep you posted.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="lead-name">Name</Label>
          <Input
            id="lead-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ama"
            className="rounded-lg"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lead-phone">WhatsApp / phone number</Label>
          <Input
            id="lead-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="024 000 0000"
            className="rounded-lg"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lead-town">Town / area (optional)</Label>
          <Input
            id="lead-town"
            value={town}
            onChange={(event) => setTown(event.target.value)}
            placeholder="Legon"
            className="rounded-lg"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lead-note">What you&apos;re after (optional)</Label>
          <Textarea
            id="lead-note"
            rows={1}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Branded aprons for an event…"
            className="rounded-lg"
          />
        </div>
      </div>
      <label
        htmlFor="lead-consent"
        className="mt-4 flex items-start gap-3 text-sm text-muted-foreground"
      >
        <Checkbox
          id="lead-consent"
          checked={consent}
          onCheckedChange={(value) => setConsent(value === true)}
          className="mt-0.5"
        />
        <span>
          Tick to opt in — {storeName} may contact you about orders and shop updates. See the{' '}
          <Link href="/privacy" className="underline underline-offset-2">
            privacy policy
          </Link>
          .
        </span>
      </label>
      {error && <p className="mt-2 text-sm font-medium text-destructive">{error}</p>}
      <Button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="mt-4 h-11 font-semibold"
      >
        {busy ? 'Saving…' : 'Save my details'}
      </Button>
    </section>
  );
}
