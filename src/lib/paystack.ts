// Paystack transport. Server-only. Every function degrades gracefully when
// PAYSTACK_SECRET_KEY is unset so the app boots and runs without billing —
// routes then return a clear "not configured" error instead of crashing.
//
// Amounts are always whole pesewas (GHS minor units); Paystack expects the same.
import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

const PAYSTACK_BASE = 'https://api.paystack.co';

export function isPaystackConfigured(): boolean {
  return Boolean(env.PAYSTACK_SECRET_KEY);
}

export type InitializeResult =
  | { ok: true; authorizationUrl: string; accessCode: string; reference: string }
  | { ok: false; error: string };

export async function initializeTransaction(input: {
  email: string;
  amountPesewas: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<InitializeResult> {
  if (!isPaystackConfigured()) {
    return { ok: false, error: 'Paystack is not configured' };
  }
  try {
    const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.email,
        amount: input.amountPesewas,
        currency: 'GHS',
        reference: input.reference,
        ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.status || !data?.data?.authorization_url) {
      return { ok: false, error: data?.message ?? `Paystack initialize failed (${res.status})` };
    }
    return {
      ok: true,
      authorizationUrl: data.data.authorization_url as string,
      accessCode: data.data.access_code as string,
      reference: data.data.reference as string,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Paystack request failed' };
  }
}

export type VerifiedTransaction = {
  status: string;
  amountPesewas: number;
  currency: string;
  reference: string;
  paidAt: string | null;
  metadata: Record<string, unknown> | null;
  raw: unknown;
};

export type VerifyResult =
  | { ok: true; transaction: VerifiedTransaction }
  | { ok: false; error: string };

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  if (!isPaystackConfigured()) {
    return { ok: false, error: 'Paystack is not configured' };
  }
  try {
    const res = await fetch(
      `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY ?? ''}` },
      },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.status || !data?.data) {
      return { ok: false, error: data?.message ?? `Paystack verify failed (${res.status})` };
    }
    const tx = data.data;
    return {
      ok: true,
      transaction: {
        status: String(tx.status ?? 'failed'),
        amountPesewas: Number(tx.amount ?? 0),
        currency: String(tx.currency ?? 'GHS'),
        reference: String(tx.reference ?? reference),
        paidAt: tx.paid_at ? String(tx.paid_at) : tx.paidAt ? String(tx.paidAt) : null,
        metadata: (tx.metadata ?? null) as Record<string, unknown> | null,
        raw: tx,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Paystack request failed' };
  }
}

// Paystack signs the raw request body with HMAC-SHA512 using the secret key and
// sends the hex digest in the `x-paystack-signature` header. Compare in constant
// time so a mismatch can't leak the expected signature byte by byte.
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!env.PAYSTACK_SECRET_KEY || !signature) return false;
  const expected = createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
