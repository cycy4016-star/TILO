// Verifies a Paystack payment when the customer lands back from checkout.
// Reads `reference` from the URL, calls /api/payments/verify, and shows the
// result with a clear next step. Never charges anything itself.
'use client';

import { CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { formatGhs } from '@/lib/contracts/order';
import { PaymentVerifyResult } from '@/lib/contracts/payment';

type Outcome =
  | { state: 'checking' }
  | { state: 'success'; amountPesewas: number }
  | { state: 'failed'; message: string }
  | { state: 'pending'; message: string }
  | { state: 'missing' };

function PaymentReturnBody() {
  const searchParams = useSearchParams();
  const reference = useMemo(() => searchParams.get('reference')?.trim() ?? '', [searchParams]);
  const [outcome, setOutcome] = useState<Outcome>({ state: 'checking' });

  useEffect(() => {
    if (!reference) {
      setOutcome({ state: 'missing' });
      return;
    }
    let cancelled = false;
    apiFetch(`/api/payments/verify?reference=${encodeURIComponent(reference)}`, {
      schema: PaymentVerifyResult,
    })
      .then((result) => {
        if (cancelled) return;
        if (result.status === 'SUCCESS') {
          setOutcome({ state: 'success', amountPesewas: result.amountPesewas });
        } else {
          setOutcome({
            state: result.status === 'PENDING' ? 'pending' : 'failed',
            message:
              result.status === 'PENDING'
                ? 'Paystack has not confirmed this payment yet. It settles on its own within a minute.'
                : 'Payment was not completed.',
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOutcome({ state: 'failed', message: 'Could not confirm the payment right now.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reference]);

  if (outcome.state === 'checking') {
    return (
      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardContent className="flex items-center justify-center gap-3 py-16 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          <Loader2 aria-hidden className="size-5 animate-spin" />
          Confirming payment…
        </CardContent>
      </Card>
    );
  }

  if (outcome.state === 'success') {
    return (
      <Card className="rounded-xl border border-border bg-card text-center shadow-sm">
        <CardHeader className="pb-2 pt-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CheckCircle2 aria-hidden className="size-7" />
          </span>
          <CardTitle className="mt-4 text-2xl font-bold">Payment confirmed</CardTitle>
          <CardDescription className="text-muted-foreground">
            {formatGhs(outcome.amountPesewas)} received — the order has been marked paid.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8 pt-2">
          <a href="/dashboard/customers">
            <Button className="h-11 font-semibold">Back to customers</Button>
          </a>
        </CardContent>
      </Card>
    );
  }

  const pending = outcome.state === 'pending';
  return (
    <Card className="rounded-xl border border-border bg-card text-center shadow-sm">
      <CardHeader className="pb-2 pt-8 text-center">
        <span
          className={`mx-auto flex size-12 items-center justify-center rounded-xl ${
            pending ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
          }`}
        >
          <RotateCcw aria-hidden className="size-6" />
        </span>
        <CardTitle className="mt-4 text-2xl font-bold">
          {pending ? 'Not confirmed yet' : 'Payment did not go through'}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {outcome.state === 'missing'
            ? 'No payment reference was returned. Your order is safe — check your customers list.'
            : outcome.message}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-8 pt-2">
        {outcome.state === 'failed' && reference ? (
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="h-11 px-6 font-semibold"
          >
            <RotateCcw aria-hidden className="size-4" /> Check again
          </Button>
        ) : null}
        <div className="mt-3">
          <a href="/dashboard/customers">
            <Button className="h-11 font-semibold">Back to customers</Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export function PaymentReturn() {
  return (
    <Suspense
      fallback={
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardContent className="flex items-center justify-center gap-3 py-16 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            <Loader2 aria-hidden className="size-5 animate-spin" />
            Confirming payment…
          </CardContent>
        </Card>
      }
    >
      <PaymentReturnBody />
    </Suspense>
  );
}
