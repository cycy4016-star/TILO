// @vitest-environment node
//
// Role tests. There are two independent questions these answer:
//
//  1. Who gets the platform `admin` role? Only the account matching
//     ADMIN_PHONE / ADMIN_EMAIL at sign-up. Everyone else is a plain `user`,
//     because per-shop access comes from the userId ownership columns, not a role.
//  2. Does the admin gate actually check that role? It used to be an alias for
//     requireAuth, so any signed-in user could open the cross-account monitor.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

beforeEach(() => {
  vi.resetModules();
});

describe('isAdminRole', () => {
  it('grants admin only to the exact admin role', async () => {
    const { isAdminRole } = await import('@/lib/roles');
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('user')).toBe(false);
    expect(isAdminRole('')).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });

  it('tolerates a comma-separated role list and stray whitespace', async () => {
    const { isAdminRole } = await import('@/lib/roles');
    expect(isAdminRole('user,admin')).toBe(true);
    expect(isAdminRole(' admin ')).toBe(true);
    // A substring must never count — "administrator" is not "admin".
    expect(isAdminRole('administrator')).toBe(false);
    expect(isAdminRole('useradmin')).toBe(false);
  });
});

describe('requireAdmin gate', () => {
  it('redirects a signed-in shop owner away from the admin monitor', async () => {
    vi.doMock('@/lib/auth', () => ({
      auth: {
        api: { getSession: vi.fn().mockResolvedValue({ user: { id: 'u1', role: 'user' } }) },
      },
    }));
    const redirect = vi.fn(() => {
      throw new Error('NEXT_REDIRECT');
    });
    vi.doMock('next/navigation', () => ({ redirect }));
    vi.doMock('next/headers', () => ({ headers: async () => new Headers() }));
    // biome-ignore lint/style/noRestrictedImports: the gate under test is server-only by design
    const { requireAdmin } = await import('@/lib/require-admin');
    await expect(requireAdmin()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('lets a platform admin through', async () => {
    vi.doMock('@/lib/auth', () => ({
      auth: {
        api: { getSession: vi.fn().mockResolvedValue({ user: { id: 'u1', role: 'admin' } }) },
      },
    }));
    vi.doMock('next/navigation', () => ({ redirect: vi.fn() }));
    vi.doMock('next/headers', () => ({ headers: async () => new Headers() }));
    // biome-ignore lint/style/noRestrictedImports: the gate under test is server-only by design
    const { requireAdmin } = await import('@/lib/require-admin');
    await expect(requireAdmin()).resolves.toMatchObject({ user: { id: 'u1' } });
  });
});

describe('requireAdminUser API gate', () => {
  it('returns 403 for a signed-in non-admin instead of redirecting a fetch', async () => {
    vi.doMock('@/lib/require-auth', () => ({
      requireAuth: vi
        .fn()
        .mockResolvedValue({ id: 'u1', email: 'user@example.test', role: 'user' }),
    }));

    const { requireAdminUser } = await import('@/lib/require-admin-api');
    const error = await requireAdminUser().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Response);
    expect((error as Response).status).toBe(403);
  });

  it('passes a platform admin through', async () => {
    vi.doMock('@/lib/require-auth', () => ({
      requireAuth: vi
        .fn()
        .mockResolvedValue({ id: 'u1', email: 'owner@example.test', role: 'admin' }),
    }));

    const { requireAdminUser } = await import('@/lib/require-admin-api');
    await expect(requireAdminUser()).resolves.toMatchObject({ id: 'u1' });
  });
});
