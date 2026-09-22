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
      <Card className="rounded-[2rem] border-2 border-amber-950 bg-white shadow-[8px_8px_0_0_#451a03] dark:bg-stone-900">
        <CardContent className="flex items-center justify-center gap-3 py-16 text-sm font-black uppercase tracking-widest text-amber-600">
          <Loader2 aria-hidden className="size-5 animate-spin" />
          Confirming payment…
        </CardContent>
      </Card>
    );
  }

  if (outcome.state === 'success') {
    return (
      <Card className="rounded-[2rem] border-2 border-emerald-700 bg-white text-center shadow-[8px_8px_0_0_#047857] dark:bg-stone-900">
        <CardHeader className="pb-2 pt-8 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <CheckCircle2 aria-hidden className="size-7" />
          </span>
          <CardTitle className="mt-4 font-display text-3xl font-black uppercase">
            Paid up!
          </CardTitle>
          <CardDescription className="font-medium">
            {formatGhs(outcome.amountPesewas)} received — the order has been marked paid.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8 pt-2">
          <a href="/dashboard/customers">
            <Button className="h-12 rounded-full bg-emerald-700 px-6 font-black uppercase tracking-wide text-white hover:bg-emerald-800">
              Back to the wall
            </Button>
          </a>
        </CardContent>
      </Card>
    );
  }

  const pending = outcome.state === 'pending';
  return (
    <Card className="rounded-[2rem] border-2 border-amber-950 bg-white text-center shadow-[8px_8px_0_0_#451a03] dark:bg-stone-900">
      <CardHeader className="pb-2 pt-8 text-center">
        <span
          className={`mx-auto flex size-14 items-center justify-center rounded-2xl text-white ${
            pending ? 'bg-amber-600' : 'bg-red-600'
          }`}
        >
          <RotateCcw aria-hidden className="size-6" />
        </span>
        <CardTitle className="mt-4 font-display text-2xl font-black uppercase">
          {pending ? 'Not confirmed yet' : 'Payment did not go through'}
        </CardTitle>
        <CardDescription className="font-medium">
          {outcome.state === 'missing'
            ? 'No payment was passed back. Your order is safe — check the wall.'
            : outcome.message}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-8 pt-2">
        {outcome.state === 'failed' && reference ? (
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="h-12 rounded-full px-6 font-black uppercase tracking-wide"
          >
            <RotateCcw aria-hidden className="size-4" /> Check again
          </Button>
        ) : null}
        <div className="mt-3">
          <a href="/dashboard/customers">
            <Button className="h-12 rounded-full bg-amber-950 px-6 font-black uppercase tracking-wide text-amber-300 hover:bg-stone-900">
              Back to the wall
            </Button>
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
        <Card className="rounded-[2rem] border-2 border-amber-950 bg-white shadow-[8px_8px_0_0_#451a03] dark:bg-stone-900">
          <CardContent className="flex items-center justify-center gap-3 py-16 text-sm font-black uppercase tracking-widest text-amber-600">
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
