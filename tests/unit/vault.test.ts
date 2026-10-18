// Vault diff tests: the integrity check must catch every real shrink, stay
// quiet on growth, and never confuse a closed shopfront with data loss.
import { describe, expect, it } from 'vitest';
import { diffWorlds, lossHeadline, type VaultCounts } from '@/lib/vault-diff';

const base: VaultCounts = {
  users: 3,
  stores: 3,
  storesActive: 3,
  items: 12,
  orders: 4,
  customers: 2,
  leads: 2,
  feedback: 1,
  signups: 3,
  signins: 5,
};

describe('diffWorlds', () => {
  it('reports nothing when the world is unchanged', () => {
    expect(diffWorlds(base, { ...base })).toEqual([]);
  });

  it('reports nothing when the world only grew', () => {
    const grown = { ...base, users: 5, stores: 4, items: 30, orders: 9 };
    expect(diffWorlds(base, grown)).toEqual([]);
  });

  it('names every shrink, biggest first, with its label', () => {
    const after = { ...base, stores: 0, items: 0, orders: 2 };
    expect(diffWorlds(base, after)).toEqual([
      { key: 'items', label: 'catalogue items', before: 12, after: 0, lost: 12 },
      { key: 'stores', label: 'storefronts', before: 3, after: 0, lost: 3 },
      { key: 'orders', label: 'orders', before: 4, after: 2, lost: 2 },
    ]);
  });

  it('treats a closed storefront as routine — only total stores count', () => {
    const after = { ...base, storesActive: 1 };
    expect(diffWorlds(base, after)).toEqual([]);
  });

  it('catches a wiped ledger through its cascading sign-in rows', () => {
    const after = { ...base, users: 0, signups: 0, signins: 0, customers: 0 };
    const losses = diffWorlds(base, after);
    // Biggest first; ties keep watch order (users before sign-ups).
    expect(losses.map((entry) => entry.key)).toEqual(['signins', 'users', 'signups', 'customers']);
    expect(losses.map((entry) => entry.lost)).toEqual([5, 3, 3, 2]);
  });

  it('renders the loss headline', () => {
    const losses = diffWorlds(base, { ...base, stores: 0, items: 7 });
    expect(lossHeadline(losses)).toBe('5 catalogue items · 3 storefronts');
  });

  it('speaks singular when exactly one thing went missing', () => {
    const losses = diffWorlds(base, { ...base, items: 11 });
    expect(lossHeadline(losses)).toBe('1 catalogue item');
  });
});
