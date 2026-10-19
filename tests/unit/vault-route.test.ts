// @vitest-environment node
//
// Vault route tests: the list does the integrity diff against the newest
// snapshot, POST archives a manual snapshot, the download route serves the
// payload as a file, and everything stays behind the admin gate.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const gate = vi.hoisted(() => ({ requireAdminUser: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    worldSnapshot: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: { count: vi.fn(), findMany: vi.fn() },
    store: { count: vi.fn(), findMany: vi.fn() },
    storeItem: { count: vi.fn(), findMany: vi.fn() },
    storeItemImage: { findMany: vi.fn() },
    productCategory: { findMany: vi.fn() },
    promotion: { findMany: vi.fn() },
    socialAccount: { findMany: vi.fn() },
    customer: { count: vi.fn(), findMany: vi.fn() },
    order: { count: vi.fn(), findMany: vi.fn() },
    orderLineItem: { findMany: vi.fn() },
    feedback: { count: vi.fn(), findMany: vi.fn() },
    adminAlert: { findMany: vi.fn() },
    authEvent: { count: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('@/lib/require-admin-api', () => gate);
vi.mock('@/lib/db', () => db);

const counts = {
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

beforeEach(() => {
  vi.clearAllMocks();
  gate.requireAdminUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  db.prisma.user.count.mockResolvedValue(3);
  db.prisma.store.count.mockResolvedValue(3);
  db.prisma.storeItem.count.mockResolvedValue(12);
  db.prisma.order.count.mockResolvedValue(4);
  db.prisma.customer.count.mockResolvedValue(2);
  db.prisma.feedback.count.mockResolvedValue(1);
  db.prisma.authEvent.count.mockResolvedValue(5);
  for (const model of [
    'user',
    'store',
    'storeItem',
    'storeItemImage',
    'productCategory',
    'promotion',
    'socialAccount',
    'customer',
    'order',
    'orderLineItem',
    'feedback',
    'adminAlert',
    'authEvent',
  ] as const) {
    db.prisma[model].findMany.mockResolvedValue([]);
  }
  db.prisma.worldSnapshot.deleteMany.mockResolvedValue({ count: 0 });
});

describe('admin vault route', () => {
  it('diffs the live world against the newest snapshot', async () => {
    db.prisma.worldSnapshot.findMany.mockResolvedValue([
      {
        id: 'snap-1',
        createdAt: new Date('2026-10-18T12:00:00.000Z'),
        trigger: 'manual',
        counts,
        bytes: 9000,
        imagesIncluded: true,
      },
    ]);
    // Live world after a wipe: stores and items gone, everything else intact.
    db.prisma.store.count.mockResolvedValue(0);
    db.prisma.storeItem.count.mockResolvedValue(0);

    const { GET } = await import('@/app/api/admin/vault/route');
    const response = await GET(new Request('http://test/api/admin/vault'));
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.since).toBe('2026-10-18T12:00:00.000Z');
    expect(body.loss).toEqual([
      { key: 'items', label: 'catalogue items', before: 12, after: 0, lost: 12 },
      { key: 'stores', label: 'storefronts', before: 3, after: 0, lost: 3 },
    ]);
    expect(body.snapshots).toHaveLength(1);
    expect(body.current.users).toBe(3);
  });

  it('reports a clean bill of health when nothing shrank', async () => {
    db.prisma.worldSnapshot.findMany.mockResolvedValue([
      {
        id: 'snap-1',
        createdAt: new Date('2026-10-18T12:00:00.000Z'),
        trigger: 'boot',
        counts,
        bytes: 9000,
        imagesIncluded: false,
      },
    ]);
    const { GET } = await import('@/app/api/admin/vault/route');
    const response = await GET(new Request('http://test/api/admin/vault'));
    const body = await response.json();
    expect(body.loss).toEqual([]);
  });

  it('returns an empty loss list when no baseline exists yet', async () => {
    db.prisma.worldSnapshot.findMany.mockResolvedValue([]);
    const { GET } = await import('@/app/api/admin/vault/route');
    const response = await GET(new Request('http://test/api/admin/vault'));
    const body = await response.json();
    expect(body.since).toBeNull();
    expect(body.loss).toEqual([]);
  });

  it('archives a manual snapshot on POST', async () => {
    db.prisma.worldSnapshot.create.mockResolvedValue({
      id: 'snap-2',
      createdAt: new Date('2026-10-18T15:00:00.000Z'),
      trigger: 'manual',
      counts,
      bytes: 4200,
      imagesIncluded: true,
    });

    const { POST } = await import('@/app/api/admin/vault/route');
    const response = await POST(new Request('http://test/api/admin/vault', { method: 'POST' }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBe('snap-2');
    expect(body.trigger).toBe('manual');
    expect(body.counts.stores).toBe(3);
    expect(db.prisma.worldSnapshot.create).toHaveBeenCalledTimes(1);
    expect(db.prisma.worldSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trigger: 'manual',
          imagesIncluded: true,
          payload: expect.objectContaining({
            version: 1,
            takenAt: expect.any(String),
          }),
        }),
      }),
    );
  });

  it('serves one snapshot as a downloadable file', async () => {
    db.prisma.worldSnapshot.findUnique.mockResolvedValue({
      id: 'snap-1',
      createdAt: new Date('2026-10-18T12:00:00.000Z'),
      trigger: 'manual',
      payload: { version: 1, users: [] },
    });
    const { GET } = await import('@/app/api/admin/vault/[id]/route');
    const response = await GET(new Request('http://test/api/admin/vault/snap-1'), {
      params: Promise.resolve({ id: 'snap-1' }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('tilza-vault-');
    const body = await response.json();
    expect(body.version).toBe(1);
  });

  it('404s a download for a missing snapshot', async () => {
    db.prisma.worldSnapshot.findUnique.mockResolvedValue(null);
    const { GET } = await import('@/app/api/admin/vault/[id]/route');
    const response = await GET(new Request('http://test/api/admin/vault/nope'), {
      params: Promise.resolve({ id: 'nope' }),
    });
    expect(response.status).toBe(404);
  });

  it('stays behind the admin gate', async () => {
    gate.requireAdminUser.mockRejectedValueOnce(
      Response.json({ error: 'Forbidden' }, { status: 403 }),
    );
    const { GET } = await import('@/app/api/admin/vault/route');
    const response = await GET(new Request('http://test/api/admin/vault'));
    expect(response.status).toBe(403);
  });
});
