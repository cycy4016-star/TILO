// Public feedback form behind /feedback — the human half of the platform's
// problem detection. The error ledger catches what crashed; this catches what
// a person can be bothered to type. Open to everyone, including signed-out
// storefront shoppers, so it never asks for an account.
//
// Best-effort by design: the submit is a plain fetch, failures land inline on
// the form, and a `website` honeypot quietly swallows bots (the server
// acknowledges them without saving anything).
'use client';

import { CheckCircle2, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FeedbackCreate, type FeedbackKind } from '@/lib/contracts/feedback';

const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: 'BUG', label: 'Something broke' },
  { value: 'COMPLAINT', label: "I'm unhappy" },
  { value: 'SUGGESTION', label: 'I have an idea' },
  { value: 'PRAISE', label: 'I like it' },
  { value: 'OTHER', label: 'Something else' },
];

const RATINGS = [1, 2, 3, 4, 5] as const;

export function FeedbackForm() {
  const [kind, setKind] = useState<FeedbackKind>('BUG');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [honeypot, setHoneypot] = useState('');
  const [slug, setSlug] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [sent, setSent] = useState(false);

  // A storefront links here as /feedback?shop=<slug> so the report is filed
  // against that shop. Read it once on mount rather than via useSearchParams,
  // which would force a Suspense boundary on a static page for one query param.
  useEffect(() => {
    const shop = new URLSearchParams(window.location.search).get('shop');
    if (shop) setSlug(shop.trim().slice(0, 80));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const payload = {
      kind,
      message: message.trim(),
      email: email.trim(),
      rating: rating ?? undefined,
      page: window.location.pathname,
      slug: slug || undefined,
      website: honeypot,
    };
    // Validate here for instant feedback; the server runs the same contract.
    const check = FeedbackCreate.safeParse(payload);
    if (!check.success) {
      const first = check.error.flatten().fieldErrors;
      setError(first.message?.[0] ?? first.email?.[0] ?? 'Check the form and try again.');
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as {
        errors?: Record<string, string>;
      } | null;
      if (!response.ok) {
        setError(body?.errors?.message ?? body?.errors?.form ?? 'Could not send that just now.');
        return;
      }
      setSent(true);
      toast.success('Thanks — your note is in the queue');
    } catch {
      setError('Could not send that just now. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center sm:p-10">
        <CheckCircle2 aria-hidden className="mx-auto size-10 text-primary" />
        <h2 className="mt-4 font-display text-h3">Message received</h2>
        <p className="mx-auto mt-2 max-w-md text-small text-muted-foreground">
          A real person reads every note. If you left an email address, we will get back to you
          there.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6 h-11 rounded-md px-6 font-semibold"
          onClick={() => {
            setSent(false);
            setMessage('');
            setRating(null);
            setError(undefined);
          }}
        >
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-5 rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <fieldset className="grid gap-2">
        <legend className="text-small font-medium">What is it about?</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setKind(entry.value)}
              className={`h-9 rounded-md px-4 text-small font-medium transition-colors ${
                kind === entry.value
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="text-small font-medium">How was it, all in all?</legend>
        <div className="flex items-center gap-1.5">
          {RATINGS.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`Rate ${value} out of 5`}
              aria-pressed={rating === value}
              onClick={() => setRating(rating === value ? null : value)}
              className={`inline-flex size-10 items-center justify-center rounded-md transition-colors ${
                rating != null && value <= rating
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Star
                aria-hidden
                className="size-5"
                fill={rating != null && value <= rating ? 'currentColor' : 'none'}
              />
            </button>
          ))}
          <span className="ml-2 text-caption text-muted-foreground">Optional</span>
        </div>
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="feedback-message" className="text-small font-medium">
          Tell us what happened
        </Label>
        <Textarea
          id="feedback-message"
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="What you were doing, what you expected, what actually happened…"
          rows={6}
          maxLength={2000}
          required
          aria-invalid={error ? true : undefined}
          className="rounded-md border-border bg-background"
        />
        <p className="text-caption text-muted-foreground">At least 10 characters.</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="feedback-email" className="text-small font-medium">
          Email <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="feedback-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error ? true : undefined}
          className="h-11 rounded-md border-border bg-background"
        />
        <p className="text-caption text-muted-foreground">
          Only so we can reply — never used for anything else.
        </p>
      </div>

      {/* Honeypot: humans never see or focus this, bots usually fill it. */}
      <div aria-hidden className="sr-only">
        <label htmlFor="feedback-website">Leave this empty</label>
        <input
          id="feedback-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-small text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-11 rounded-md font-semibold">
        {pending ? 'Sending…' : 'Send feedback'}
      </Button>
    </form>
  );
}
