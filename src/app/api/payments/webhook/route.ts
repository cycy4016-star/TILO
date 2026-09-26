// Paystack webhook. Unauthenticated by design (Paystack calls it); authenticity
// comes from the HMAC-SHA512 signature over the raw body. The webhook is the
// source of truth for settling payments — always return 200 once verified so
// Paystack stops retrying, even when we ignore the event.
import 'server-only';

import { NextResponse } from 'next/server';
import { settlePayment } from '@/lib/payments';
import { isPaystackConfigured, verifyWebhookSignature } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

type PaystackEvent = {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    paid_at?: string;
    paidAt?: string;
    amount?: number;
  };
};

export async function POST(request: Request) {
  if (!isPaystackConfigured()) {
    return NextResponse.json({ error: 'Paystack is not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: PaystackEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const reference = event.data?.reference;
  if (event.event === 'charge.success' && reference) {
    // No tenancy check is needed here, and none should be added: the webhook is
    // unauthenticated, and settlePayment only ever touches the order that THIS
    // reference was issued against (found by the unique reference, never by a
    // client-supplied id), verifying the amount before marking it paid. A forged
    // reference therefore settles nothing.
    await settlePayment({
      reference,
      providerStatus: event.data?.status ?? 'success',
      paidAt: event.data?.paid_at ?? event.data?.paidAt ?? null,
      providerAmountPesewas: typeof event.data?.amount === 'number' ? event.data.amount : null,
      raw: event.data,
    });
  }

  return NextResponse.json({ received: true });
}
