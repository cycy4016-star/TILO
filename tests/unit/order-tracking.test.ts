// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { signOrderToken, verifyOrderToken } from '@/lib/order-tracking';

beforeEach(() => {
  vi.stubEnv('ORDER_TRACKING_SECRET', 'order-tracking-test-secret');
  vi.stubEnv('BETTER_AUTH_SECRET', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('order tracking tokens', () => {
  it('round-trips the order id', () => {
    const token = signOrderToken('order-123');
    expect(token.startsWith('order-123.')).toBe(true);
    expect(verifyOrderToken(token)).toBe('order-123');
  });

  it('rejects a tampered signature', () => {
    const token = signOrderToken('order-123');
    const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
    expect(verifyOrderToken(tampered)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyOrderToken('')).toBeNull();
    expect(verifyOrderToken('order-123')).toBeNull();
    expect(verifyOrderToken('order-123.')).toBeNull();
    expect(verifyOrderToken('.signature')).toBeNull();
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
