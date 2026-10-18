// @vitest-environment node
//
// In-app restore tests: rows come back in foreign-key order, existing rows are
// skipped rather than overwritten, ISO dates and base64 images convert back,
// a unique-rule clash degrades to row-by-row without sinking the table, and
// the route keeps its guards.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const gate = vi.hoisted(() => ({ requireAdminUser: vi.fn() }));

const db = vi.hoisted(() => {
  const calls: string[] = [];
  const makeDelegate = (name: string) => ({
    createMany: vi.fn(async (args: unknown) => {
      calls.push(name);
      const data = (args as { data?: unknown[] }).data ?? [];
      return { count: data.length };
    }),
    create: vi.fn(async (_args: unknown) => {
      calls.push(`${name}:create`);
      return {};
    }),
  });
  return {
    calls,
    prisma: {
      worldSnapshot: { findUnique: vi.fn() },
      user: makeDelegate('user'),
      store: makeDelegate('store'),
      productCategory: makeDelegate('productCategory'),
      storeItem: makeDelegate('storeItem'),
      promotion: makeDelegate('promotion'),
      socialAccount: makeDelegate('socialAccount'),
      customer: makeDelegate('customer'),
      order: makeDelegate('order'),
      orderLineItem: makeDelegate('orderLineItem'),
      feedback: makeDelegate('feedback'),
      adminAlert: makeDelegate('adminAlert'),
      authEvent: makeDelegate('authEvent'),
    },
  };
});

vi.mock('@/lib/require-admin-api', () => gate);
vi.mock('@/lib/db', () => db);

const payload = {
  version: 1,
  takenAt: '2026-10-18T12:00:00.000Z',
  imagesIncluded: true,
  users: [
    {
      id: 'u1',
      name: 'Abrantie',
      email: 'abrantie@example.com',
      role: 'user',
      banned: false,
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z',
    },
  ],
  stores: [
    {
      id: 's1',
      userId: 'u1',
      name: 'Phone Hub',
      slug: 'phone-hub',
      logoB64: Buffer.from('logo-bytes').toString('base64'),
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z',
    },
  ],
  items: [
    {
      id: 'i1',
      storeId: 's1',
      name: 'Galaxy A15',
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  db.calls.length = 0;
  gate.requireAdminUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  db.prisma.worldSnapshot.findUnique.mockResolvedValue({
    id: 'snap-1',
    createdAt: new Date('2026-10-18T12:00:00.000Z'),
    payload,
  });
});

async function restore(id = 'snap-1') {
  const { POST } = await import('@/app/api/admin/vault/[id]/restore/route');
  return POST(new Request(`http://test/api/admin/vault/${id}/restore`, { method: 'POST' }), {
    params: Promise.resolve({ id }),
  });
}

describe('vault restore', () => {
  it('brings back missing rows in foreign-key order and reports the tally', async () => {
    const response = await restore();
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.restored).toBe(3);
    expect(body.skipped).toBe(0);
    expect(body.byTable).toEqual([
      { key: 'users', restored: 1, skipped: 0 },
      { key: 'stores', restored: 1, skipped: 0 },
      { key: 'items', restored: 1, skipped: 0 },
    ]);

    const userAt = db.calls.indexOf('user');
    const storeAt = db.calls.indexOf('store');
    const itemAt = db.calls.indexOf('storeItem');
    expect(userAt).toBeGreaterThanOrEqual(0);
    expect(storeAt).toBeGreaterThan(userAt);
    expect(itemAt).toBeGreaterThan(storeAt);
  });

  it('never overwrites: duplicates are skipped via skipDuplicates', async () => {
    db.prisma.user.createMany.mockResolvedValueOnce({ count: 0 });
    const body = await (await restore()).json();
    expect(body.skipped).toBe(1);
    expect(db.prisma.user.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });

  it('converts ISO dates back to Date and base64 images back to bytes', async () => {
    await restore();
    expect(db.prisma.user.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            id: 'u1',
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
        ],
      }),
    );
    expect(db.prisma.store.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ id: 's1', logo: expect.any(Buffer) })],
      }),
    );
  });

  it('falls back to row-by-row when a unique rule trips a whole batch', async () => {
    db.prisma.store.createMany.mockRejectedValueOnce(new Error('unique violation'));
    const body = await (await restore()).json();

    const stores = body.byTable.find((entry: { key: string }) => entry.key === 'stores');
    expect(stores).toEqual({ key: 'stores', restored: 1, skipped: 0 });
    expect(db.calls).toContain('store:create');
  });

  it('counts an unrecoverable row as skipped instead of hiding it', async () => {
    db.prisma.store.createMany.mockRejectedValueOnce(new Error('unique violation'));
    db.prisma.store.create.mockRejectedValueOnce(new Error('email in use'));
    const body = await (await restore()).json();

    const stores = body.byTable.find((entry: { key: string }) => entry.key === 'stores');
    expect(stores).toEqual({ key: 'stores', restored: 0, skipped: 1 });
    expect(body.skipped).toBe(1);
  });

  it('404s a missing snapshot', async () => {
    db.prisma.worldSnapshot.findUnique.mockResolvedValue(null);
    expect((await restore('nope')).status).toBe(404);
  });

  it('400s an unrecognised payload version', async () => {
    db.prisma.worldSnapshot.findUnique.mockResolvedValue({
      id: 'snap-1',
      createdAt: new Date(),
      payload: { version: 99 },
    });
    expect((await restore()).status).toBe(400);
  });

  it('stays behind the admin gate', async () => {
    gate.requireAdminUser.mockRejectedValueOnce(
      Response.json({ error: 'Forbidden' }, { status: 403 }),
    );
    expect((await restore()).status).toBe(403);
  });
});
