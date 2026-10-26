// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  prisma: {
    store: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    storeItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    productCategory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    promotion: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    order: { create: vi.fn() },
    customer: { findFirst: vi.fn(), create: vi.fn() },
    notification: { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
const auth = vi.hoisted(() => ({ requireAuth: vi.fn(), getSessionUser: vi.fn() }));

vi.mock('@/lib/db', () => db);
vi.mock('@/lib/require-auth', () => auth);
vi.mock('server-only', () => ({}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ORDER_TRACKING_SECRET = 'test-order-tracking-secret';
  auth.requireAuth.mockResolvedValue({ id: 'staff-1' });
  auth.getSessionUser.mockResolvedValue(null);
});

afterEach(() => {
  delete process.env.ORDER_TRACKING_SECRET;
});

const storeRow = { id: 'store-1', userId: 'staff-1', name: 'S', slug: 's' };

function itemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    storeId: 'store-1',
    categoryId: null,
    kind: 'PRODUCT',
    name: 'Widget',
    description: null,
    pricePesewas: 2500,
    costPricePesewas: null,
    compareAtPricePesewas: null,
    sortOrder: 0,
    active: true,
    stock: null as number | null,
    image: null,
    images: [],
    createdAt: new Date('2026-10-07T00:00:00.000Z'),
    updatedAt: new Date('2026-10-07T00:00:00.000Z'),
    ...overrides,
  };
}

describe('catalogue creation flow', () => {
  it('creates a stocked item on a shelf', async () => {
    db.prisma.store.findUnique.mockResolvedValue(storeRow);
    db.prisma.storeItem.create.mockImplementation(async ({ data }: { data: object }) => ({
      ...itemRow(),
      ...data,
    }));
    const { POST } = await import('@/app/api/store/items/route');
    const response = await POST(
      new Request('http://test/api/store/items', {
        method: 'POST',
        body: JSON.stringify({ name: 'Widget', pricePesewas: 2500, stock: 7 }),
      }),
    );
    expect(response.status).toBe(201);
    expect(db.prisma.storeItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Widget', stock: 7, storeId: 'store-1' }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({ stock: 7 });
  });

  it('creates an item and its cover photo in one multipart request', async () => {
    db.prisma.store.findUnique.mockResolvedValue(storeRow);
    db.prisma.storeItem.create.mockResolvedValue(
      itemRow({ imageMime: 'image/webp', images: [{ id: 'img-new' }] }),
    );
    const form = new FormData();
    form.append('payload', JSON.stringify({ name: 'Widget', pricePesewas: 2500 }));
    form.append(
      'file',
      new File([new Uint8Array([1, 2, 3])], 'widget.webp', { type: 'image/webp' }),
    );
    const { POST } = await import('@/app/api/store/items/route');
    const response = await POST(
      new Request('http://test/api/store/items', {
        method: 'POST',
        body: form,
      }),
    );
    expect(response.status).toBe(201);
    expect(db.prisma.storeItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Widget',
          storeId: 'store-1',
          imageMime: 'image/webp',
          images: {
            create: {
              position: 0,
              image: expect.any(Uint8Array),
              imageMime: 'image/webp',
            },
          },
        }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      hasImage: true,
      imageIds: ['img-new'],
    });
  });

  it('creates a promo targeted at items and categories', async () => {
    db.prisma.store.findUnique.mockResolvedValue(storeRow);
    db.prisma.promotion.create.mockImplementation(async ({ data }: { data: object }) => ({
      id: 'promo-1',
      storeId: 'store-1',
      code: null,
      kind: 'PERCENT',
      value: 20,
      minSubtotalPesewas: null,
      active: true,
      startsAt: null,
      endsAt: null,
      image: null,
      createdAt: new Date('2026-10-07T00:00:00.000Z'),
      updatedAt: new Date('2026-10-07T00:00:00.000Z'),
      ...data,
    }));
    const { POST } = await import('@/app/api/store/promotions/route');
    const response = await POST(
      new Request('http://test/api/store/promotions', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Launch',
          kind: 'PERCENT',
          value: 20,
          itemIds: ['item-1'],
          categoryIds: ['cat-1'],
        }),
      }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      itemIds: ['item-1'],
      categoryIds: ['cat-1'],
    });
  });

  it('rejects an unknown category icon', async () => {
    db.prisma.store.findUnique.mockResolvedValue(storeRow);
    const { POST } = await import('@/app/api/store/categories/route');
    const response = await POST(
      new Request('http://test/api/store/categories', {
        method: 'POST',
        body: JSON.stringify({ name: 'Drinks', icon: 'spaceship' }),
      }),
    );
    expect(response.status).toBe(400);
    expect(db.prisma.productCategory.create).not.toHaveBeenCalled();
  });
});

describe('checkout stock guard', () => {
  const orderBody = {
    lines: [{ itemId: 'item-1', quantity: 2 }],
    customerName: 'Ama',
    phone: '+233241112200',
  };

  it('refuses a line deeper than stock without writing an order', async () => {
    db.prisma.store.findFirst.mockResolvedValue({ ...storeRow, active: true });
    db.prisma.storeItem.findMany.mockResolvedValue([itemRow({ stock: 1 })]);
    db.prisma.customer.findFirst.mockResolvedValue(null);
    db.prisma.customer.create.mockResolvedValue({
      id: 'customer-1',
      name: 'Ama',
      phone: '+233241112200',
      address: null,
    });
    const { POST } = await import('@/app/api/public/store/[slug]/orders/route');
    const response = await POST(
      new Request('http://test/api/public/store/s/orders', {
        method: 'POST',
        body: JSON.stringify(orderBody),
      }),
      { params: Promise.resolve({ slug: 's' }) },
    );
    expect(response.status).toBe(409);
    expect(db.prisma.order.create).not.toHaveBeenCalled();
  });

  it('decrements tracked stock on a successful order', async () => {
    const orderCreate = db.prisma.order.create as ReturnType<typeof vi.fn>;
    orderCreate.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'TILZA-20261007-ABCDEFGH',
      customerId: 'customer-1',
      description: '2x Widget',
      status: 'PENDING',
      amountPesewas: 5000,
      discountPesewas: 0,
      promoCode: null,
      fulfillmentMethod: 'DIRECT_PICKUP',
      deliveryStatus: 'NOT_APPLICABLE',
      customerLat: null,
      customerLng: null,
      deliveryFeePesewas: 0,
      riderId: null,
      paidAt: null,
      createdAt: new Date('2026-10-07T00:00:00.000Z'),
      updatedAt: new Date('2026-10-07T00:00:00.000Z'),
    });
    db.prisma.store.findFirst.mockResolvedValue({ ...storeRow, active: true });
    db.prisma.storeItem.findMany.mockResolvedValue([itemRow({ stock: 5 })]);
    db.prisma.customer.findFirst.mockResolvedValue(null);
    db.prisma.customer.create.mockResolvedValue({
      id: 'customer-1',
      name: 'Ama',
      phone: '+233241112200',
      address: null,
    });
    db.prisma.order = { create: orderCreate } as never;
    db.prisma.storeItem.updateMany.mockResolvedValue({ count: 1 });
    (db.prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => unknown) => fn(db.prisma),
    );
    const { POST } = await import('@/app/api/public/store/[slug]/orders/route');
    const response = await POST(
      new Request('http://test/api/public/store/s/orders', {
        method: 'POST',
        body: JSON.stringify(orderBody),
      }),
      { params: Promise.resolve({ slug: 's' }) },
    );
    expect(response.status).toBe(201);
    expect(db.prisma.storeItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'item-1', stock: { gte: 2 } }),
      }),
    );
    expect(orderCreate).toHaveBeenCalled();
  });
});
