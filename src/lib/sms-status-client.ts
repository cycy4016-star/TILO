// Tilo app code.
'use client';

// Client-side view of the SMS capability, plus the error copy shared by every
// auth form. Server-only facts (isSmsConfigured) are reached through
// /api/public/sms-status rather than process.env, because only NEXT_PUBLIC_*
// vars are bundled into client code — a plain SMS_PROVIDER would read as
// undefined in the browser and always claim SMS is off.

import { useEffect, useState } from 'react';

export type SmsStatus = {
  /** A provider is selected AND its API key is present. */
  configured: boolean;
  /** Display name of the active provider, or "none". */
  provider: string;
};

// One probe per page load, shared by every auth form mounted on it. A failed
// fetch resolves to `null` ("unknown") rather than throwing: an unknown status
// must never block the forms — it only suppresses the pre-flight hint.
let inFlight: Promise<SmsStatus | null> | null = null;

export function getSmsStatus(): Promise<SmsStatus | null> {
  if (!inFlight) {
    inFlight = fetch('/api/public/sms-status', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<SmsStatus>) : null))
      .catch(() => null);
  }
  return inFlight;
}

/** `null` while loading or if the probe failed; never throws. */
export function useSmsStatus(): SmsStatus | null {
  const [status, setStatus] = useState<SmsStatus | null>(null);
  useEffect(() => {
    let alive = true;
    void getSmsStatus().then((value) => {
      if (alive) setStatus(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  return status;
}

/**
 * Rewrite a raw better-auth / provider failure into copy someone can act on.
 * Provider failures arrive as sentences like "The confirmation code could not be
 * sent: BMS 401: unauthorized" — right for a log, alarming in a form. Anything
 * unrecognised passes through untouched so a genuinely specific message (a
 * rate-limit window, a bad invite code) still reaches the user verbatim.
 */
export function friendlyOtpError(message?: string): string {
  const raw = (message ?? '').trim();
  if (!raw) return 'The code did not send. Try again.';

  const lower = raw.toLowerCase();
  if (lower.includes('not configured') || lower.includes('sms_send_failed')) {
    return 'Text-message verification is not switched on for this deployment yet. Please try again later.';
  }
  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('abort')) {
    return 'The message service took too long to respond. Try again in a moment.';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many codes requested. Wait a minute, then try again.';
  }
  if (lower.includes('rejected')) {
    return "That number couldn't be reached on this network. Check the number, or try another one.";
  }
  if (lower.includes('otp_expired') || lower.includes('expired')) {
    return 'That code has expired. Request a new one.';
  }
  return raw;
}
