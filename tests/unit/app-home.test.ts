// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

vi.mock('@/lib/db', () => db);
vi.mock('server-only', () => ({}));

import { resolveAppHome } from '@/lib/app-home';

describe('signed-in app home', () => {
  beforeEach(() => {
    db.prisma.user.findUnique.mockReset();
  });

  it('sends platform admins to the ops console without a database lookup', async () => {
    await expect(resolveAppHome({ id: 'admin-1', role: 'admin' })).resolves.toBe(
      '/dashboard/admin',
    );
    expect(db.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('sends shop owners to the dashboard', async () => {
    db.prisma.user.findUnique.mockResolvedValue({
      store: { id: 'store-1' },
      audiences: [{ id: 'audience-1' }],
    });
    await expect(resolveAppHome({ id: 'owner-1', role: 'user' })).resolves.toBe('/dashboard');
  });

  it('sends shoppers with no shop to their saved orders', async () => {
    db.prisma.user.findUnique.mockResolvedValue({
      store: null,
      audiences: [{ id: 'audience-1' }],
    });
    await expect(resolveAppHome({ id: 'shopper-1', role: 'user' })).resolves.toBe('/orders');
  });

  it('sends a signed-in account with no shop or shopper history into setup', async () => {
    db.prisma.user.findUnique.mockResolvedValue({ store: null, audiences: [] });
    await expect(resolveAppHome({ id: 'new-1', role: 'user' })).resolves.toBe('/welcome');
  });
});
