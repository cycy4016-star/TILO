// Authenticated: start a Paystack checkout for an order's balance.
import 'server-only';

import { NextResponse } from 'next/server';
import { PaymentInitialize, PaymentInitializeResult } from '@/lib/contracts/payment';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { initializeTransaction, isPaystackConfigured } from '@/lib/paystack';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    if (!isPaystackConfigured()) {
      return NextResponse.json({ error: 'Paystack is not configured' }, { status: 503 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = PaymentInitialize.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ errors: { orderId: 'Order is required' } }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (!order.amountPesewas || order.amountPesewas <= 0) {
      return NextResponse.json({ error: 'This order has no amount to charge' }, { status: 400 });
    }
    if (order.paidAt) {
      return NextResponse.json({ error: 'This order is already paid' }, { status: 409 });
    }

    const reference = `TILO-PAY-${crypto.randomUUID()}`;
    const payment = await prisma.paymentTransaction.create({
      data: {
        reference,
        orderId: order.id,
        amountPesewas: order.amountPesewas,
        email: user.email,
        status: 'PENDING',
      },
    });

    const result = await initializeTransaction({
      email: user.email,
      amountPesewas: order.amountPesewas,
      reference,
      // Default callback: our own return page, which verifies the transaction
      // the moment the customer lands back. Override via PAYSTACK_CALLBACK_URL.
      callbackUrl: env.PAYSTACK_CALLBACK_URL ?? `${env.BETTER_AUTH_URL}/payments/return`,
      metadata: { orderId: order.id, orderNumber: order.orderNumber, paymentId: payment.id },
    });
    if (!result.ok) {
      await prisma.paymentTransaction.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: { authorizationUrl: result.authorizationUrl },
    });

    return NextResponse.json(
      PaymentInitializeResult.parse({
        authorizationUrl: result.authorizationUrl,
        reference: result.reference,
        amountPesewas: order.amountPesewas,
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
