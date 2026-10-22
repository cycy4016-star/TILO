// Capability tokens for the public order tracker. The token is the order id
// plus an HMAC signature, so a buyer can revisit their order without an account
// while a guessed id still cannot read anyone else's order.
import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_TOKEN_LENGTH = 200;

function trackingSecret(): string | null {
  return process.env.ORDER_TRACKING_SECRET?.trim() || process.env.BETTER_AUTH_SECRET || null;
}

function sign(orderId: string, secret: string): string {
  return createHmac('sha256', secret).update(orderId).digest('base64url');
}

export function signOrderToken(orderId: string): string {
  const secret = trackingSecret();
  if (!secret) throw new Error('Order tracking secret is not configured');
  return `${orderId}.${sign(orderId, secret)}`;
}

/** Returns the order id only when the signature is intact. */
export function verifyOrderToken(token: string): string | null {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  const separator = token.lastIndexOf('.');
  if (separator <= 0 || separator === token.length - 1) return null;
  const orderId = token.slice(0, separator);
  const received = token.slice(separator + 1);
  const secret = trackingSecret();
  if (!secret) return null;
  const expected = sign(orderId, secret);
  if (received.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return orderId;
}
