// Pure vault logic — client-safe (no Prisma, no server-only) so the integrity
// diff is unit-testable and the console can import it without dragging the
// database along.

export const VAULT_COUNT_KEYS = [
  'users',
  'stores',
  'storesActive',
  'items',
  'orders',
  'customers',
  'leads',
  'feedback',
  'signups',
  'signins',
] as const;

export type VaultCountKey = (typeof VAULT_COUNT_KEYS)[number];

export type VaultCounts = Record<VaultCountKey, number>;

/**
 * Keys the loss detector watches. `storesActive` is deliberately excluded:
 * opening and closing a shopfront is a routine operator toggle, not data loss.
 * Everything else only shrinks when rows are actually removed — so a shrink is
 * always worth a red banner.
 */
const LOSS_WATCHED: VaultCountKey[] = [
  'users',
  'stores',
  'items',
  'orders',
  'customers',
  'leads',
  'feedback',
  'signups',
  'signins',
];

const LABELS: Record<VaultCountKey, string> = {
  users: 'accounts',
  stores: 'storefronts',
  storesActive: 'open storefronts',
  items: 'catalogue items',
  orders: 'orders',
  customers: 'customers',
  leads: 'leads',
  feedback: 'feedback notes',
  signups: 'sign-ups',
  signins: 'sign-ins',
};

export type VaultLoss = {
  key: VaultCountKey;
  label: string;
  before: number;
  after: number;
  lost: number;
};

/** What went missing between two worlds: only shrinks count, biggest first. */
export function diffWorlds(before: VaultCounts, after: VaultCounts): VaultLoss[] {
  const losses: VaultLoss[] = [];
  for (const key of LOSS_WATCHED) {
    const lost = before[key] - after[key];
    if (lost > 0) {
      losses.push({ key, label: LABELS[key], before: before[key], after: after[key], lost });
    }
  }
  return losses.sort((a, b) => b.lost - a.lost);
}

/** "3 storefronts · 12 catalogue items" — the one-line loss headline. */
export function lossHeadline(losses: ReadonlyArray<{ lost: number; label: string }>): string {
  return losses
    .map(
      (entry) => `${entry.lost} ${entry.lost === 1 ? entry.label.replace(/s$/, '') : entry.label}`,
    )
    .join(' · ');
}
