// Capability tokens for the public order tracker. A token carries the order id
// plus a signed expiry, so a buyer can revisit their order without an account
// while a guessed id still cannot read anyone else's order. Tokens created by
// the previous release had no expiry; those legacy links are accepted only
// until LEGACY_TOKEN_SUNSET_MS, then the permanent-capability window closes.
import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_TOKEN_LENGTH = 200;
const TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;
// 180 days after the expiry-aware release (Nov 2026). Legacy two-part tokens
// stop verifying after this instant; remove the legacy branch when the sunset
// has passed.
const LEGACY_TOKEN_SUNSET_MS = Date.UTC(2027, 4, 2);

function trackingSecret(): string | null {
  return process.env.ORDER_TRACKING_SECRET?.trim() || process.env.BETTER_AUTH_SECRET || null;
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function signatureMatches(received: string, expected: string): boolean {
  if (received.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function signOrderToken(orderId: string): string {
  const secret = trackingSecret();
  if (!secret) throw new Error('Order tracking secret is not configured');
  const expiresAt = Math.floor((Date.now() + TOKEN_TTL_MS) / 1000);
  return `${orderId}.${expiresAt}.${sign(`${orderId}.${expiresAt}`, secret)}`;
}

/** Returns the order id only when the signature is intact and unexpired. */
export function verifyOrderToken(token: string): string | null {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  const secret = trackingSecret();
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length === 2) {
    // Legacy `orderId.signature` capability. It has no expiry of its own, so it
    // is bounded by the release-wide sunset instead of staying valid forever.
    if (Date.now() >= LEGACY_TOKEN_SUNSET_MS) return null;
    const [orderId, received] = parts;
    if (!orderId || !received) return null;
    return signatureMatches(received, sign(orderId, secret)) ? orderId : null;
  }

  if (parts.length !== 3) return null;
  const [orderId, expiry, received] = parts;
  if (!orderId || !expiry || !received) return null;
  const expiresAt = Number(expiry);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) return null;
  if (expiresAt * 1000 <= Date.now()) return null;
  const signed = `${orderId}.${expiry}`;
  return signatureMatches(received, sign(signed, secret)) ? orderId : null;
}
