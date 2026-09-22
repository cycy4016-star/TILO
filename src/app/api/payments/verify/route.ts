// Authenticated: verify a Paystack transaction after the customer returns from
// checkout, and settle the order. The webhook is the source of truth; this is
// the fast path so the UI can confirm without waiting for the callback.
import 'server-only';

import { NextResponse } from 'next/server';
import { PaymentVerifyResult } from '@/lib/contracts/payment';
import { prisma } from '@/lib/db';
import { settlePayment } from '@/lib/payments';
import { isPaystackConfigured, verifyTransaction } from '@/lib/paystack';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    if (!isPaystackConfigured()) {
      return NextResponse.json({ error: 'Paystack is not configured' }, { status: 503 });
    }

    const reference = new URL(request.url).searchParams.get('reference')?.trim();
    if (!reference) {
      return NextResponse.json({ error: 'reference is required' }, { status: 400 });
    }

    const payment = await prisma.paymentTransaction.findUnique({ where: { reference } });
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    const verified = await verifyTransaction(reference);
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: 502 });
    }

    const settled = await settlePayment({
      reference,
      providerStatus: verified.transaction.status,
      paidAt: verified.transaction.paidAt,
      providerAmountPesewas: verified.transaction.amountPesewas,
      raw: verified.transaction.raw,
    });

    const order = payment.orderId
      ? await prisma.order.findUnique({ where: { id: payment.orderId } })
      : null;

    return NextResponse.json(
      PaymentVerifyResult.parse({
        reference,
        status: settled?.status ?? payment.status,
        orderId: payment.orderId,
        amountPesewas: payment.amountPesewas,
        paidAt: order?.paidAt ? order.paidAt.toISOString() : null,
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
