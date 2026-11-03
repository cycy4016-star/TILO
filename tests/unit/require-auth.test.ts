// @vitest-environment node
//
// Suspension must be enforced on every authenticated read, not only when a
// session is minted. These tests cover a live session belonging to an account
// that was banned after sign-in, including temporary bans that have expired.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    session: { deleteMany: vi.fn() },
    pushSubscription: { deleteMany: vi.fn() },
  },
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: auth.getSession } } }));
vi.mock('@/lib/db', () => db);

import { getSessionUser, requireAuth, requireSession } from '@/lib/require-auth';

const session = (user: Record<string, unknown>) => ({
  session: { id: 'session-1', userId: 'user-1' },
  user: { id: 'user-1', role: 'user', ...user },
});

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.session.deleteMany.mockResolvedValue({ count: 1 });
  db.prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
});

describe('session suspension gate', () => {
  it('returns the user for a live, unbanned session', async () => {
    auth.getSession.mockResolvedValue(session({ banned: false }));
    await expect(getSessionUser()).resolves.toMatchObject({ id: 'user-1' });
    expect(db.prisma.session.deleteMany).not.toHaveBeenCalled();
  });

  it('treats a permanently banned account as signed out and revokes its sessions', async () => {
    auth.getSession.mockResolvedValue(session({ banned: true, banExpires: null }));
    await expect(getSessionUser()).resolves.toBeNull();
    expect(db.prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(db.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });

  it('treats an unexpired temporary ban as signed out', async () => {
    auth.getSession.mockResolvedValue(
      session({ banned: true, banExpires: new Date(Date.now() + 60_000) }),
    );
    await expect(getSessionUser()).resolves.toBeNull();
  });

  it('lets an expired temporary ban through', async () => {
    auth.getSession.mockResolvedValue(
      session({ banned: true, banExpires: new Date(Date.now() - 60_000) }),
    );
    await expect(getSessionUser()).resolves.toMatchObject({ id: 'user-1' });
    expect(db.prisma.session.deleteMany).not.toHaveBeenCalled();
  });

  it('throws 401 from the API gates when the account is suspended', async () => {
    auth.getSession.mockResolvedValue(session({ banned: true }));
    const error = await requireAuth().catch((response: unknown) => response);
    expect(error).toBeInstanceOf(Response);
    expect((error as Response).status).toBe(401);
    await expect(requireSession()).rejects.toBeInstanceOf(Response);
  });
});
