// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ requireAuth: vi.fn() }));
const ownership = vi.hoisted(() => ({ requireOwnedStoreChild: vi.fn() }));
const db = vi.hoisted(() => {
  const prisma = {
    storeItem: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
    storeItemImage: {
      count: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { prisma };
});

vi.mock('@/lib/require-auth', () => auth);
vi.mock('@/lib/ownership', () => ownership);
vi.mock('@/lib/db', () => db);
vi.mock('server-only', () => ({}));

function itemRow(imageIds: string[] = []) {
  return {
    id: 'item-1',
    storeId: 'store-1',
    categoryId: null,
    kind: 'PRODUCT' as const,
    name: 'Widget',
    description: null,
    pricePesewas: 2500,
    costPricePesewas: null,
    compareAtPricePesewas: null,
    sortOrder: 0,
    active: true,
    imageMime: null,
    stock: null,
    createdAt: new Date('2026-10-19T00:00:00.000Z'),
    updatedAt: new Date('2026-10-19T00:00:00.000Z'),
    images: imageIds.map((id) => ({ id })),
  };
}

function uploadRequest(url: string, bytes = new Uint8Array([1, 2, 3])) {
  const form = new FormData();
  form.append('file', new File([bytes], 'photo.jpg', { type: 'image/jpeg' }));
  return new Request(url, { method: 'PUT', body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireAuth.mockResolvedValue({ id: 'staff-1' });
  ownership.requireOwnedStoreChild.mockResolvedValue({
    id: 'item-1',
    storeId: 'store-1',
    categoryId: null,
    name: 'Widget',
  });
  db.prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
  db.prisma.storeItem.findUniqueOrThrow.mockResolvedValue(itemRow(['img-new']));
  db.prisma.storeItem.update.mockResolvedValue({});
});

describe('item gallery routes', () => {
  it('appends a photo after the current last position', async () => {
    db.prisma.storeItemImage.count.mockResolvedValue(2);
    db.prisma.storeItemImage.aggregate.mockResolvedValue({ _max: { position: 4 } });
    db.prisma.storeItemImage.create.mockResolvedValue({ id: 'img-new' });

    const { PUT } = await import('@/app/api/store/items/[itemId]/images/route');
    const response = await PUT(uploadRequest('http://test/api/store/items/item-1/images'), {
      params: Promise.resolve({ itemId: 'item-1' }),
    });

    expect(response.status).toBe(200);
    expect(db.prisma.storeItemImage.create).toHaveBeenCalledWith({
      data: {
        itemId: 'item-1',
        position: 5,
        image: expect.any(Uint8Array),
        imageMime: 'image/jpeg',
      },
    });
    await expect(response.json()).resolves.toMatchObject({ imageIds: ['img-new'] });
  });

  it('stops at the gallery limit', async () => {
    db.prisma.storeItemImage.count.mockResolvedValue(8);

    const { PUT } = await import('@/app/api/store/items/[itemId]/images/route');
    const response = await PUT(uploadRequest('http://test/api/store/items/item-1/images'), {
      params: Promise.resolve({ itemId: 'item-1' }),
    });

    expect(response.status).toBe(400);
    expect(db.prisma.storeItemImage.create).not.toHaveBeenCalled();
  });

  it('promotes a photo to cover and renumbers the rest', async () => {
    db.prisma.storeItemImage.findMany.mockResolvedValue([
      { id: 'img-1' },
      { id: 'img-2' },
      { id: 'img-3' },
    ]);
    db.prisma.storeItemImage.findUniqueOrThrow.mockResolvedValue({ imageMime: 'image/png' });
    db.prisma.storeItem.findUniqueOrThrow.mockResolvedValue(itemRow(['img-3', 'img-1', 'img-2']));

    const { PUT } = await import('@/app/api/store/items/[itemId]/images/[imageId]/route');
    const response = await PUT(
      new Request('http://test/api/store/items/item-1/images/img-3', { method: 'PUT' }),
      {
        params: Promise.resolve({ itemId: 'item-1', imageId: 'img-3' }),
      },
    );

    expect(response.status).toBe(200);
    expect(db.prisma.storeItemImage.update).toHaveBeenCalledTimes(3);
    expect(db.prisma.storeItemImage.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'img-3' },
      data: { position: 0 },
    });
    expect(db.prisma.storeItemImage.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'img-1' },
      data: { position: 1 },
    });
    expect(db.prisma.storeItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { imageMime: 'image/png' },
    });
    await expect(response.json()).resolves.toMatchObject({
      imageIds: ['img-3', 'img-1', 'img-2'],
    });
  });

  it('hides a photo that belongs to another item', async () => {
    db.prisma.storeItemImage.findMany.mockResolvedValue([{ id: 'img-1' }]);

    const { PUT } = await import('@/app/api/store/items/[itemId]/images/[imageId]/route');
    const response = await PUT(
      new Request('http://test/api/store/items/item-1/images/img-9', { method: 'PUT' }),
      {
        params: Promise.resolve({ itemId: 'item-1', imageId: 'img-9' }),
      },
    );

    expect(response.status).toBe(404);
    expect(db.prisma.storeItemImage.update).not.toHaveBeenCalled();
  });

  it('deletes a photo and exposes the new cover mime', async () => {
    db.prisma.storeItemImage.findFirst
      .mockResolvedValueOnce({ id: 'img-1' })
      .mockResolvedValueOnce({ imageMime: 'image/png' });
    db.prisma.storeItem.findUniqueOrThrow.mockResolvedValue(itemRow(['img-2']));

    const { DELETE } = await import('@/app/api/store/items/[itemId]/images/[imageId]/route');
    const response = await DELETE(
      new Request('http://test/api/store/items/item-1/images/img-1', { method: 'DELETE' }),
      {
        params: Promise.resolve({ itemId: 'item-1', imageId: 'img-1' }),
      },
    );

    expect(response.status).toBe(200);
    expect(db.prisma.storeItemImage.delete).toHaveBeenCalledWith({ where: { id: 'img-1' } });
    expect(db.prisma.storeItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { imageMime: 'image/png' },
    });
  });

  it('serves a public gallery photo', async () => {
    db.prisma.storeItemImage.findFirst.mockResolvedValue({
      image: new Uint8Array([9, 8, 7]),
      imageMime: 'image/webp',
      updatedAt: new Date('2026-10-19T00:00:00.000Z'),
    });

    const { GET } = await import('@/app/api/public/store/items/[itemId]/images/[imageId]/route');
    const response = await GET(
      new Request('http://test/api/public/store/items/item-1/images/img-1'),
      { params: Promise.resolve({ itemId: 'item-1', imageId: 'img-1' }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([9, 8, 7]));
  });

  it('404s a missing public gallery photo', async () => {
    db.prisma.storeItemImage.findFirst.mockResolvedValue(null);

    const { GET } = await import('@/app/api/public/store/items/[itemId]/images/[imageId]/route');
    const response = await GET(
      new Request('http://test/api/public/store/items/item-1/images/nope'),
      { params: Promise.resolve({ itemId: 'item-1', imageId: 'nope' }) },
    );

    expect(response.status).toBe(404);
  });
});
