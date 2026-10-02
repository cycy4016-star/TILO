// @vitest-environment node
//
// Category (shelf heading) API: tenancy isolation and the two writes that could
// silently damage a catalogue — accepting another shop's categoryId on an item,
// and deleting a heading that still has products on it.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ requireAuth: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    // Tenancy: owner-scoped reads go through findFirst({ id, store: { userId } }) —
    // never a bare findUnique on a client-supplied id.
    store: { findUnique: vi.fn(), create: vi.fn() },
    productCategory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    storeItem: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/require-auth', () => auth);
vi.mock('@/lib/db', () => db);
vi.mock('server-only', () => ({}));

const STORE = { id: 'store-1', userId: 'user-1', slug: 'amas', name: 'Ama’s' };
const CATEGORY = {
  id: 'cat-1',
  storeId: 'store-1',
  name: 'Beverages',
  sortOrder: 0,
  active: true,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  _count: { items: 0 },
};

const { GET, POST } = await import('@/app/api/store/categories/route');
const { PATCH, DELETE } = await import('@/app/api/store/categories/[categoryId]/route');
const { POST: CREATE_ITEM } = await import('@/app/api/store/items/route');

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/store/categories', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function context(categoryId: string) {
  return { params: Promise.resolve({ categoryId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireAuth.mockResolvedValue({ id: 'user-1', email: 'user@example.test' });
});

describe('category routes', () => {
  it('requires authentication at the route boundary', async () => {
    auth.requireAuth.mockRejectedValueOnce(
      Response.json({ error: 'Unauthorized' }, { status: 401 }),
    );
    const res = await GET(new Request('http://localhost/api/store/categories'));
    expect(res.status).toBe(401);
  });

  it('lists an empty shelf rather than 404ing a new account', async () => {
    db.prisma.store.findUnique.mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost/api/store/categories'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
    expect(db.prisma.productCategory.findMany).not.toHaveBeenCalled();
  });

  it('scopes the list to the caller’s own store', async () => {
    db.prisma.store.findUnique.mockResolvedValueOnce(STORE);
    db.prisma.productCategory.findMany.mockResolvedValueOnce([CATEGORY]);
    const res = await GET(new Request('http://localhost/api/store/categories'));
    expect(db.prisma.productCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: 'store-1' } }),
    );
    const payload = await res.json();
    expect(payload.items[0].itemCount).toBe(0);
  });

  it('refuses a duplicate category name in the same store', async () => {
    db.prisma.store.findUnique.mockResolvedValueOnce(STORE);
    db.prisma.productCategory.findFirst.mockResolvedValueOnce({ id: 'cat-9' });
    const res = await POST(jsonRequest({ name: 'Beverages' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      errors: { name: 'You already have a category with that name' },
    });
    expect(db.prisma.productCategory.create).not.toHaveBeenCalled();
  });

  it('rejects a blank name before touching the database', async () => {
    db.prisma.store.findUnique.mockResolvedValueOnce(STORE);
    const res = await POST(jsonRequest({ name: '' }));
    expect(res.status).toBe(400);
    expect(db.prisma.productCategory.findFirst).not.toHaveBeenCalled();
  });

  it('404s a category id belonging to another shop', async () => {
    // requireOwnedCategory reaches it through store.userId, so the foreign row
    // simply does not resolve — no PATCH/DELETE ever runs.
    db.prisma.productCategory.findFirst.mockResolvedValueOnce(null);
    const res = await PATCH(jsonRequest({ name: 'Sneaky' }), context('cat-foreign'));
    expect(res.status).toBe(404);
    expect(db.prisma.productCategory.update).not.toHaveBeenCalled();
    expect(db.prisma.productCategory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cat-foreign', store: { userId: 'user-1' } } }),
    );
  });

  it('refuses to delete a heading that still has products', async () => {
    db.prisma.productCategory.findFirst.mockResolvedValueOnce(CATEGORY);
    db.prisma.storeItem.count.mockResolvedValueOnce(3);
    const res = await DELETE(
      new Request('http://localhost/x', { method: 'DELETE' }),
      context('cat-1'),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: '3 products still on this shelf',
      itemCount: 3,
    });
    expect(db.prisma.productCategory.delete).not.toHaveBeenCalled();
  });

  it('deletes an empty heading', async () => {
    db.prisma.productCategory.findFirst.mockResolvedValueOnce(CATEGORY);
    db.prisma.storeItem.count.mockResolvedValueOnce(0);
    db.prisma.productCategory.delete.mockResolvedValueOnce(CATEGORY);
    const res = await DELETE(
      new Request('http://localhost/x', { method: 'DELETE' }),
      context('cat-1'),
    );
    expect(res.status).toBe(204);
    expect(db.prisma.productCategory.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
  });

  it('uses singular grammar when one product is left behind', async () => {
    db.prisma.productCategory.findFirst.mockResolvedValueOnce(CATEGORY);
    db.prisma.storeItem.count.mockResolvedValueOnce(1);
    const res = await DELETE(
      new Request('http://localhost/x', { method: 'DELETE' }),
      context('cat-1'),
    );
    expect(await res.json()).toEqual({ error: '1 product still on this shelf', itemCount: 1 });
  });
});

describe('item ↔ category tenancy', () => {
  it('refuses a categoryId from another shop on item create', async () => {
    db.prisma.store.findUnique.mockResolvedValueOnce(STORE);
    // FK only checks existence — this helper is what makes it ownership-aware.
    db.prisma.productCategory.findFirst.mockResolvedValueOnce(null);
    const res = await CREATE_ITEM(
      jsonRequest({ name: 'Latte', pricePesewas: 1500, categoryId: 'cat-foreign' }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      errors: { categoryId: 'Pick a category from this catalogue' },
    });
    expect(db.prisma.storeItem.create).not.toHaveBeenCalled();
  });

  it('accepts an unassigned product with no category', async () => {
    db.prisma.store.findUnique.mockResolvedValueOnce(STORE);
    db.prisma.storeItem.create.mockResolvedValueOnce({
      id: 'item-1',
      storeId: 'store-1',
      kind: 'PRODUCT' as const,
      name: 'Latte',
      description: null,
      categoryId: null,
      pricePesewas: 1500,
      costPricePesewas: null,
      compareAtPricePesewas: null,
      sortOrder: 0,
      active: true,
      image: null,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    });
    const res = await CREATE_ITEM(jsonRequest({ name: 'Latte', pricePesewas: 1500 }));
    expect(res.status).toBe(201);
    expect(db.prisma.productCategory.findFirst).not.toHaveBeenCalled();
  });
});
