// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { signOrderToken, verifyOrderToken } from '@/lib/order-tracking';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-03T12:00:00.000Z');
const SECRET = 'order-tracking-test-secret';

function legacyToken(orderId: string): string {
  return `${orderId}.${createHmac('sha256', SECRET).update(orderId).digest('base64url')}`;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv('ORDER_TRACKING_SECRET', SECRET);
  vi.stubEnv('BETTER_AUTH_SECRET', '');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('order tracking tokens', () => {
  it('round-trips the order id', () => {
    const token = signOrderToken('order-123');
    expect(token.startsWith('order-123.')).toBe(true);
    expect(token.split('.')).toHaveLength(3);
    expect(verifyOrderToken(token)).toBe('order-123');
  });

  it('rejects a tampered signature', () => {
    const token = signOrderToken('order-123');
    const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
    expect(verifyOrderToken(tampered)).toBeNull();
  });

  it('rejects a tampered expiry even when the rest of the token is intact', () => {
    const token = signOrderToken('order-123');
    const [orderId, expiry, signature] = token.split('.');
    const tampered = `${orderId}.${Number(expiry) + 60}.${signature}`;
    expect(verifyOrderToken(tampered)).toBeNull();
  });

  it('rejects a token after its 180-day expiry', () => {
    const token = signOrderToken('order-123');
    vi.setSystemTime(new Date(NOW.getTime() + 179 * DAY_MS));
    expect(verifyOrderToken(token)).toBe('order-123');
    vi.setSystemTime(new Date(NOW.getTime() + 181 * DAY_MS));
    expect(verifyOrderToken(token)).toBeNull();
  });

  it('accepts legacy signed links only before the permanent-token sunset', () => {
    const token = legacyToken('order-123');
    vi.setSystemTime(new Date('2027-05-01T00:00:00.000Z'));
    expect(verifyOrderToken(token)).toBe('order-123');
    vi.setSystemTime(new Date('2027-05-03T00:00:00.000Z'));
    expect(verifyOrderToken(token)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyOrderToken('')).toBeNull();
    expect(verifyOrderToken('order-123')).toBeNull();
    expect(verifyOrderToken('order-123.')).toBeNull();
    expect(verifyOrderToken('.signature')).toBeNull();
    expect(verifyOrderToken('order-123..signature')).toBeNull();
    expect(verifyOrderToken('order-123.abc.signature')).toBeNull();
    expect(verifyOrderToken('order-123.0.signature')).toBeNull();
  });

  it('binds the token to one order', () => {
    expect(verifyOrderToken(signOrderToken('order-a'))).toBe('order-a');
    expect(verifyOrderToken(signOrderToken('order-b'))).toBe('order-b');
    expect(signOrderToken('order-a')).not.toBe(signOrderToken('order-b'));
  });

  it('falls back to the auth secret when no dedicated secret is set', () => {
    vi.stubEnv('ORDER_TRACKING_SECRET', '');
    vi.stubEnv('BETTER_AUTH_SECRET', 'auth-secret');
    expect(verifyOrderToken(signOrderToken('order-123'))).toBe('order-123');
  });

  it('refuses to mint without a secret and verifies nothing', () => {
    vi.stubEnv('ORDER_TRACKING_SECRET', '');
    vi.stubEnv('BETTER_AUTH_SECRET', '');
    expect(() => signOrderToken('order-123')).toThrow('not configured');
    expect(verifyOrderToken('order-123.signature')).toBeNull();
  });
});
