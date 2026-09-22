// Shared payment settlement used by both the client verify route and the
// Paystack webhook. Idempotent: once a reference is SUCCESS it never regresses,
// so a webhook retry (or verify-after-webhook) can't double-charge or double-mark.
import 'server-only';
import { prisma } from '@/lib/db';

type LocalStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'ABANDONED';

function normalizeStatus(providerStatus: string): LocalStatus {
  switch (providerStatus.toLowerCase()) {
    case 'success':
      return 'SUCCESS';
    case 'failed':
    case 'reversed':
      return 'FAILED';
    case 'abandoned':
      return 'ABANDONED';
    default:
      return 'PENDING';
  }
}

export async function settlePayment(input: {
  reference: string;
  providerStatus: string;
  paidAt?: string | null;
  providerRef?: string | null;
  providerAmountPesewas?: number | null;
  raw?: unknown;
}): Promise<{
  reference: string;
  status: LocalStatus;
  orderId: string | null;
  amountPesewas: number;
} | null> {
  const payment = await prisma.paymentTransaction.findUnique({
    where: { reference: input.reference },
  });
  if (!payment) return null;

  const normalized = normalizeStatus(input.providerStatus);
  // A successful verification must match the amount we actually charged. A
  // mismatched amount is recorded as FAILED, never silently marked paid.
  const amountMatches =
    normalized !== 'SUCCESS' ||
    input.providerAmountPesewas == null ||
    input.providerAmountPesewas === payment.amountPesewas;
  const status: LocalStatus = normalized === 'SUCCESS' && !amountMatches ? 'FAILED' : normalized;

  if (payment.status !== 'SUCCESS') {
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        status,
        providerRef: input.providerRef ?? payment.providerRef,
        raw: input.raw ? JSON.stringify(input.raw) : payment.raw,
      },
    });
    if (status === 'SUCCESS' && payment.orderId) {
      const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
      await prisma.order.updateMany({
        where: { id: payment.orderId, paidAt: null },
        data: { paidAt },
      });
    }
  }

  return {
    reference: payment.reference,
    status,
    orderId: payment.orderId,
    amountPesewas: payment.amountPesewas,
  };
}
