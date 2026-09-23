// SMS transport via BMS Africa (https://bms.africa, the mNotify gateway:
// https://api.mnotify.com) — the approved Ghana provider. Arkesel
// (https://arkesel.com) remains available behind env.SMS_PROVIDER as an
// alternative. Both are cheap pay-per-SMS, one JSON endpoint each.
//
// Every attempt is also written to the SmsUsage ledger so a single-workspace
// deployment can see exactly what it spends (see the dashboard "SMS this
// month" card). Ledger writes never throw.
//
// Never throws — callers always get a result object so a failed send is logged
// and retried on the next sweep instead of crashing the job.
import 'server-only';
import type { SmsSource } from '@prisma/client';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { toE164 } from '@/lib/phone';

export type SmsSendResult = {
  ok: boolean;
  providerRef: string | null;
  error: string | null;
};

export function isSmsConfigured(): boolean {
  return (
    (env.SMS_PROVIDER === 'bms' && Boolean(env.BMS_API_KEY)) ||
    (env.SMS_PROVIDER === 'arkesel' && Boolean(env.ARKESEL_API_KEY))
  );
}

export function smsProviderName(): string {
  return env.SMS_PROVIDER === 'bms' ? 'BMS' : env.SMS_PROVIDER === 'arkesel' ? 'Arkesel' : 'none';
}

// Normalise local Ghana numbers to +233 E.164 (shared helper — see lib/phone).
export function normalizePhone(input: string): string {
  return toE164(input);
}

// Rough billing estimate: Arkesel bills one credit per GSM segment, per
// recipient. Basic GSM-7 (printable ASCII) is 160 chars per segment; anything
// with non-GSM characters bills at the shorter UCS-2 limit of 70. Our templates
// cap at 320 chars, so this is 1–2 credits on the point but the estimate is used
// for the cost readout, not billing.
// Basic GSM-7 is printable ASCII; anything else — emojis, accented letters, the
// cedis sign and em dash in our templates — pushes Arkesel into UCS-2 segments.
function isGsm7(message: string): boolean {
  return /^[\x20-\x7e]*$/.test(message);
}
function estimateSegments(message: string): number {
  const perSegment = isGsm7(message) ? 160 : 70;
  return Math.max(1, Math.ceil([...message].length / perSegment));
}

// One-time codes never belong in the at-rest ledger. Mask any 6+ digit run so
// the "SMS this month" view can count credits without exposing a live code.
function scrubOtp(message: string): string {
  return message.replace(/\d{6,}/g, '\u2022\u2022\u2022\u2022\u2022\u2022');
}

type UsageEntry = {
  to: string;
  source: SmsSource;
  body: string;
  segments: number;
  credits: number;
  providerRef: string | null;
  ok: boolean;
  error: string | null;
};

async function logUsage(entry: UsageEntry): Promise<void> {
  try {
    await prisma.smsUsage.create({ data: entry });
  } catch {
    // A ledger write must never break the actual send.
  }
}

async function sendViaArkesel(to: string, message: string): Promise<SmsSendResult> {
  const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': env.ARKESEL_API_KEY ?? '',
    },
    body: JSON.stringify({
      sender: env.ARKESEL_SENDER_ID ?? 'TILO',
      message,
      // Arkesel expects the international format without the leading "+".
      recipients: [to.replace(/^\+/, '')],
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, providerRef: null, error: `Arkesel ${res.status}: ${data?.message ?? ''}` };
  }
  const ok = data?.status === 'success';
  // Arkesel returns data as an array of { id, recipient } on success.
  const first = Array.isArray(data?.data) ? data.data[0] : data?.data;
  return {
    ok,
    providerRef: ok ? (first?.id ?? first?.message_id ?? null) : null,
    error: ok ? null : `Arkesel rejected: ${data?.message ?? 'unknown'}`,
  };
}

// BMS Africa / mNotify quick-SMS. The gateway expects recipient numbers in
// local Ghanaian format ("024...") and authenticates via an API key in the
// query string: POST https://api.mnotify.com/api/sms/quick?key=<key>
async function sendViaBms(to: string, message: string): Promise<SmsSendResult> {
  // +233XXXXXXXXX -> 0XXXXXXXXX (local format the mNotify gateway wants).
  const digits = to.replace(/\D/g, '');
  const local = digits.startsWith('0') ? digits : `0${digits.replace(/^(233)/, '')}`;
  const res = await fetch(
    `https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(env.BMS_API_KEY ?? '')}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: [local],
        sender: env.BMS_SENDER_ID ?? 'TILO',
        message,
      }),
    },
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, providerRef: null, error: `BMS ${res.status}: ${data?.message ?? ''}` };
  }
  const ok = data?.status === 'success';
  return {
    ok,
    providerRef: ok ? (data?._id ?? data?.code ?? String(data?.response_code ?? '')) || null : null,
    error: ok ? null : `BMS rejected: ${data?.message ?? 'unknown'}`,
  };
}

export async function sendSms(
  to: string,
  message: string,
  source: SmsSource = 'MANUAL',
): Promise<SmsSendResult> {
  const recipient = normalizePhone(to);
  let result: SmsSendResult;
  try {
    if (env.SMS_PROVIDER === 'bms') {
      result = await sendViaBms(recipient, message);
    } else if (env.SMS_PROVIDER === 'arkesel') {
      result = await sendViaArkesel(recipient, message);
    } else {
      result = { ok: false, providerRef: null, error: 'SMS provider not configured' };
    }
  } catch (error) {
    result = {
      ok: false,
      providerRef: null,
      error: error instanceof Error ? error.message : 'SMS request failed',
    };
  }

  const segments = estimateSegments(message);
  await logUsage({
    to: recipient,
    source,
    body: source === 'OTP' ? scrubOtp(message) : message,
    segments,
    credits: segments,
    providerRef: result.providerRef,
    ok: result.ok,
    error: result.error,
  });

  return result;
}
