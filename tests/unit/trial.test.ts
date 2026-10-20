// Free-trial policy: the 30-day window stamped at sign-up and the state the
// dashboard banner renders from it.
import { describe, expect, it } from 'vitest';
import { TRIAL_DAYS, trialEndsAtFrom, trialState } from '@/lib/trial';

describe('trial policy', () => {
  it('is a 30-day window', () => {
    expect(TRIAL_DAYS).toBe(30);
  });

  it('ends exactly TRIAL_DAYS after the start', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = trialEndsAtFrom(start);
    const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(TRIAL_DAYS);
  });
});

describe('trialState', () => {
  const now = new Date('2026-01-10T00:00:00.000Z');

  it('counts whole days remaining while active', () => {
    const state = trialState(new Date('2026-01-15T00:00:00.000Z'), now);
    expect(state.active).toBe(true);
    expect(state.expired).toBe(false);
    expect(state.daysLeft).toBe(5);
  });

  it('reports expired once the end has passed', () => {
    const state = trialState(new Date('2026-01-09T00:00:00.000Z'), now);
    expect(state.active).toBe(false);
    expect(state.expired).toBe(true);
    expect(state.daysLeft).toBe(0);
  });

  it('treats a missing date as an ended trial', () => {
    for (const value of [null, undefined, 'nonsense']) {
      const state = trialState(value, now);
      expect(state.active).toBe(false);
      expect(state.expired).toBe(true);
      expect(state.daysLeft).toBe(0);
    }
  });

  it('accepts an ISO string (the wire shape)', () => {
    const state = trialState('2026-01-20T00:00:00.000Z', now);
    expect(state.active).toBe(true);
    expect(state.daysLeft).toBe(10);
  });
});
