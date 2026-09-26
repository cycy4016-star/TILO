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

// Keep a hanging gateway from holding the OTP request open forever on the
// sign-up / verify forms. 10s is plenty for two JSON round-trips to BMS/Arkesel.
const SMS_REQUEST_TIMEOUT_MS = 10_000;

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
  userId?: string | null;
  body: string;
  segments: number;
  credits: number;
  provider: string;
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
    signal: AbortSignal.timeout(SMS_REQUEST_TIMEOUT_MS),
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
async function sendViaBms(to: string, message: string, isOtp = false): Promise<SmsSendResult> {
  // +233XXXXXXXXX -> 0XXXXXXXXX (local format the mNotify gateway wants).
  const digits = to.replace(/\D/g, '');
  const local = digits.startsWith('0') ? digits : `0${digits.replace(/^(233)/, '')}`;
  const res = await fetch(
    `https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(env.BMS_API_KEY ?? '')}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(SMS_REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        recipient: [local],
        sender: env.BMS_SENDER_ID ?? 'TILO',
        message,
        // Flag real OTP blasts so BMS routes them on the dedicated transactional
        // path (sms_type: "otp"). Without it a confirmation code rides the bulk/
        // promotional route, where operator DND filtering can silently drop the
        // line. Only set for actual OTP sends — the provider rejects it otherwise.
        // The routing is configurable: free/bonus SMS balances only flow on the
        // standard route, so accounts running on free credits set BMS_SMS_TYPE=bulk
        // (see src/lib/env.ts) and OTPs ship without the flag.
        ...(isOtp && env.BMS_SMS_TYPE === 'otp' ? { sms_type: 'otp' } : {}),
      }),
    },
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // mNotify puts the reason in `error`; Arkesel uses `message`. Surface
    // whichever the gateway sent so the real cause (e.g. a 402 wallet top-up)
    // reaches the operator, not an empty "BMS 402: ".
    return {
      ok: false,
      providerRef: null,
      error: `BMS ${res.status}: ${data?.error ?? data?.message ?? 'unknown'}`,
    };
  }
  // The campaign id — what you query the delivery-status endpoint with — lives
  // inside summary, not at the top level.
  const providerRef = data?.summary?._id ?? data?._id ?? null;
  // status === 'success' does NOT mean every number was accepted: mNotify also
  // reports rejected recipients (summary.total_rejected) — e.g. DND-registered
  // or unprovisioned numbers return "success" with the recipient rejected.
  // An all-rejected send must surface as a failure, not a silent "sent".
  const rejected = Number(data?.summary?.total_rejected ?? 0);
  const ok = data?.status === 'success' && rejected === 0;
  return {
    ok,
    providerRef,
    error: ok
      ? null
      : data?.status === 'success'
        ? `BMS rejected the send to ${local} (${rejected} of 1 number accepted)`
        : `BMS rejected: ${data?.message ?? 'unknown'} (code ${data?.code ?? 'n/a'})`,
  };
}

/**
 * Send one SMS and record it in the ledger.
 *
 * @param userId the shop the send is billed to / read back under. Pass the
 *   session user for a dashboard-initiated or automation send so the "SMS this
 *   month" card counts only that shop's traffic. Omit for sends that belong to
 *   no shop yet: sign-up OTPs (no account exists) and the platform summary
 *   digest (see runSummary in lib/automation).
 */
export async function sendSms(
  to: string,
  message: string,
  source: SmsSource = 'MANUAL',
  userId?: string | null,
): Promise<SmsSendResult> {
  const recipient = normalizePhone(to);
  let result: SmsSendResult;
  try {
    if (env.SMS_PROVIDER === 'bms') {
      result = await sendViaBms(recipient, message, source === 'OTP');
    } else if (env.SMS_PROVIDER === 'arkesel') {
      result = await sendViaArkesel(recipient, message);
    } else {
      result = { ok: false, providerRef: null, error: 'SMS provider not configured' };
    }
  } catch (error) {
    const aborted =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    result = {
      ok: false,
      providerRef: null,
      error: aborted
        ? 'SMS provider timed out'
        : error instanceof Error
          ? error.message
          : 'SMS request failed',
    };
  }

  const segments = estimateSegments(message);
  await logUsage({
    to: recipient,
    source,
    userId: userId ?? null,
    body: source === 'OTP' ? scrubOtp(message) : message,
    segments,
    credits: segments,
    provider: env.SMS_PROVIDER,
    providerRef: result.providerRef,
    ok: result.ok,
    error: result.error,
  });

  return result;
}
