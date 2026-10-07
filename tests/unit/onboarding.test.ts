// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  prisma: { store: { findUnique: vi.fn() } },
}));

vi.mock('@/lib/db', () => db);
vi.mock('server-only', () => ({}));

import { getOnboardingStatus } from '@/lib/onboarding';

function row(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Shop',
    slug: 'test-shop',
    contactPhone: '024 000 0000',
    logo: null,
    banner: new Uint8Array([1]),
    socials: [{ id: 'social-1' }],
    ...overrides,
  };
}

describe('onboarding gate', () => {
  beforeEach(() => {
    db.prisma.store.findUnique.mockReset();
  });

  it('is incomplete with no store', async () => {
    db.prisma.store.findUnique.mockResolvedValue(null);
    const status = await getOnboardingStatus('user-1');
    expect(status.complete).toBe(false);
    expect(status.hasStore).toBe(false);
  });

  it('needs a dialable phone of at least 9 digits', async () => {
    db.prisma.store.findUnique.mockResolvedValue(row({ contactPhone: '12345' }));
    const status = await getOnboardingStatus('user-1');
    expect(status.hasStore).toBe(true);
    expect(status.hasPhone).toBe(false);
    expect(status.complete).toBe(false);
  });

  it('needs at least one social', async () => {
    db.prisma.store.findUnique.mockResolvedValue(row({ socials: [] }));
    const status = await getOnboardingStatus('user-1');
    expect(status.hasSocials).toBe(false);
    expect(status.complete).toBe(false);
  });

  it('needs a logo or a banner', async () => {
    db.prisma.store.findUnique.mockResolvedValue(row({ logo: null, banner: null }));
    const status = await getOnboardingStatus('user-1');
    expect(status.hasVisual).toBe(false);
    expect(status.complete).toBe(false);
  });

  it('completes with identity, phone, socials and a visual', async () => {
    db.prisma.store.findUnique.mockResolvedValue(row());
    const status = await getOnboardingStatus('user-1');
    expect(status).toMatchObject({
      complete: true,
      hasStore: true,
      hasPhone: true,
      hasSocials: true,
      hasVisual: true,
    });
  });
});
