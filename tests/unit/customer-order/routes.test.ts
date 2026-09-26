// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ requireAuth: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    // Tenancy: owner-scoped reads go through findFirst({ id, userId }) or
    // findUnique({ userId }) — never a bare findUnique on a client-supplied id.
    customer: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    order: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
      findFirst: vi.fn(),
    },
    store: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    storeItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    storePost: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/require-auth', () => auth);
vi.mock('@/lib/db', () => db);
vi.mock('server-only', () => ({}));

const customer = {
  id: 'customer-1',
  name: 'Ama’s Boutique',
  company: 'Ama’s Boutique Ltd.',
  email: 'ama@example.test',
  phone: '024 111 2200',
  address: 'Osu, Accra',
  createdAt: new Date('2026-09-18T00:00:00.000Z'),
  updatedAt: new Date('2026-09-18T00:00:00.000Z'),
  _count: { orders: 1 },
};
const order = {
  id: 'order-1',
  orderNumber: 'TILO-20260918-ABC12345',
  customerId: 'customer-1',
  description: '12 branded aprons',
  status: 'PENDING' as const,
  amountPesewas: 4550,
  paidAt: null,
  createdAt: new Date('2026-09-18T00:00:00.000Z'),
  updatedAt: new Date('2026-09-18T00:00:00.000Z'),
  lines: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireAuth.mockResolvedValue({ id: 'staff-1', email: 'staff@example.test' });
});

describe('customer routes', () => {
  it('requires authentication at the route boundary', async () => {
    auth.requireAuth.mockRejectedValueOnce(
      Response.json({ error: 'Unauthorized' }, { status: 401 }),
    );
    const { GET } = await import('@/app/api/customers/route');
    const response = await GET(new Request('http://test/api/customers'));
    expect(response.status).toBe(401);
    expect(db.prisma.customer.findMany).not.toHaveBeenCalled();
  });

  it('searches across contact fields and returns a typed list', async () => {
    db.prisma.customer.findMany.mockResolvedValue([customer]);
    const { GET } = await import('@/app/api/customers/route');
    const response = await GET(new Request('http://test/api/customers?q=Osu'));
    expect(response.status).toBe(200);
    expect(db.prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
    await expect(response.json()).resolves.toMatchObject({
      items: [{ id: 'customer-1', orderCount: 1 }],
    });
  });

  it('scopes the customer list to the signed-in shop', async () => {
    db.prisma.customer.findMany.mockResolvedValue([]);
    const { GET } = await import('@/app/api/customers/route');
    await GET(new Request('http://test/api/customers'));
    expect(db.prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'staff-1' } }),
    );
  });

  it('stamps the session owner on a new customer, ignoring the request body', async () => {
    db.prisma.customer.create.mockResolvedValue(customer);
    const { POST } = await import('@/app/api/customers/route');
    const response = await POST(
      new Request('http://test/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          userId: 'someone-else',
        }),
      }),
    );
    expect(response.status).toBe(201);
    expect(db.prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'staff-1' }) }),
    );
  });

  it('returns field errors for invalid customer writes', async () => {
    const { POST } = await import('@/app/api/customers/route');
    const response = await POST(
      new Request('http://test/api/customers', {
        method: 'POST',
        body: JSON.stringify({ name: 'Only a name' }),
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ errors: { email: expect.any(String) } });
    expect(db.prisma.customer.create).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON payloads', async () => {
    const { POST } = await import('@/app/api/customers/route');
    const response = await POST(
      new Request('http://test/api/customers', { method: 'POST', body: '{not-json' }),
    );
    expect(response.status).toBe(400);
  });

  it('returns 404 for an unknown customer detail record', async () => {
    db.prisma.customer.findFirst.mockResolvedValue(null);
    const { GET } = await import('@/app/api/customers/[customerId]/route');
    const response = await GET(new Request('http://test/api/customers/missing'), {
      params: Promise.resolve({ customerId: 'missing' }),
    });
    expect(response.status).toBe(404);
  });

  it("hides another shop's customer instead of returning it", async () => {
    // The lookup is scoped to the session user, so a foreign id simply misses.
    db.prisma.customer.findFirst.mockResolvedValue(null);
    const { GET } = await import('@/app/api/customers/[customerId]/route');
    const response = await GET(new Request('http://test/api/customers/customer-1'), {
      params: Promise.resolve({ customerId: 'customer-1' }),
    });
    expect(response.status).toBe(404);
    expect(db.prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'customer-1', userId: 'staff-1' } }),
    );
  });
});

describe('order routes', () => {
  it('filters orders by customer and status', async () => {
    db.prisma.order.findMany.mockResolvedValue([order]);
    const { GET } = await import('@/app/api/orders/route');
    const response = await GET(
      new Request('http://test/api/orders?customerId=customer-1&status=PENDING'),
    );
    expect(response.status).toBe(200);
    expect(db.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'staff-1', customerId: 'customer-1', status: 'PENDING' },
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      items: [{ orderNumber: order.orderNumber }],
    });
  });

  it('hunts by number, description, or customer name through q', async () => {
    db.prisma.order.findMany.mockResolvedValue([order]);
    const { GET } = await import('@/app/api/orders/route');
    const response = await GET(new Request('http://test/api/orders?q=apron'));
    expect(response.status).toBe(200);
    expect(db.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'staff-1',
          OR: [
            { orderNumber: { contains: 'apron', mode: 'insensitive' } },
            { description: { contains: 'apron', mode: 'insensitive' } },
            { customer: { name: { contains: 'apron', mode: 'insensitive' } } },
          ],
        },
      }),
    );
  });

  it('names the customer on each list row for the orders hub', async () => {
    db.prisma.order.findMany.mockResolvedValue([
      { ...order, customer: { name: 'Ama’s Boutique' } },
    ]);
    const { GET } = await import('@/app/api/orders/route');
    const response = await GET(new Request('http://test/api/orders'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [{ customerName: 'Ama’s Boutique' }],
    });
  });

  it('rejects an order for a missing customer', async () => {
    db.prisma.customer.findFirst.mockResolvedValue(null);
    const { POST } = await import('@/app/api/orders/route');
    const response = await POST(
      new Request('http://test/api/orders', {
        method: 'POST',
        body: JSON.stringify({ customerId: 'missing', description: 'Stock delivery' }),
      }),
    );
    expect(response.status).toBe(404);
    expect(db.prisma.order.create).not.toHaveBeenCalled();
  });

  it("refuses to raise an order against another shop's customer", async () => {
    // The customer lookup is scoped, so a foreign customerId misses and the
    // order is never created against them.
    db.prisma.customer.findFirst.mockResolvedValue(null);
    const { POST } = await import('@/app/api/orders/route');
    const response = await POST(
      new Request('http://test/api/orders', {
        method: 'POST',
        body: JSON.stringify({ customerId: 'customer-1', description: 'Stock delivery' }),
      }),
    );
    expect(response.status).toBe(404);
    expect(db.prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 'customer-1', userId: 'staff-1' },
    });
    expect(db.prisma.order.create).not.toHaveBeenCalled();
  });

  it('files a new order under the session owner', async () => {
    db.prisma.customer.findFirst.mockResolvedValue(customer);
    db.prisma.store.findUnique.mockResolvedValue({ id: 'store-1' });
    db.prisma.order.create.mockResolvedValue(order);
    const { POST } = await import('@/app/api/orders/route');
    const response = await POST(
      new Request('http://test/api/orders', {
        method: 'POST',
        body: JSON.stringify({ customerId: 'customer-1', description: '12 branded aprons' }),
      }),
    );
    expect(response.status).toBe(201);
    expect(db.prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'staff-1' }) }),
    );
  });

  it('rejects invalid status updates and handles missing orders', async () => {
    const { PATCH } = await import('@/app/api/orders/[orderId]/route');
    const invalid = await PATCH(
      new Request('http://test/api/orders/order-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'SHIPPED' }),
      }),
      { params: Promise.resolve({ orderId: 'order-1' }) },
    );
    expect(invalid.status).toBe(400);
    db.prisma.order.findFirst.mockResolvedValue(null);
    const missing = await PATCH(
      new Request('http://test/api/orders/missing', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COMPLETED' }),
      }),
      { params: Promise.resolve({ orderId: 'missing' }) },
    );
    expect(missing.status).toBe(404);
  });

  it('marks an order paid and keeps the record typed', async () => {
    const paid = {
      ...order,
      status: 'COMPLETED' as const,
      paidAt: new Date('2026-09-19T12:00:00.000Z'),
    };
    db.prisma.order.findFirst.mockResolvedValue(order);
    db.prisma.order.update.mockResolvedValue(paid);
    const { PATCH } = await import('@/app/api/orders/[orderId]/route');
    const response = await PATCH(
      new Request('http://test/api/orders/order-1', {
        method: 'PATCH',
        body: JSON.stringify({ paidAt: '2026-09-19T12:00:00.000Z' }),
      }),
      { params: Promise.resolve({ orderId: 'order-1' }) },
    );
    expect(response.status).toBe(200);
    // The write itself is tenant-guarded, not just the read before it.
    expect(db.prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1', userId: 'staff-1' },
      data: { paidAt: new Date('2026-09-19T12:00:00.000Z') },
    });
    await expect(response.json()).resolves.toMatchObject({
      id: 'order-1',
      amountPesewas: 4550,
      paidAt: '2026-09-19T12:00:00.000Z',
    });
  });

  it("refuses to mutate another shop's order", async () => {
    db.prisma.order.findFirst.mockResolvedValue(null);
    const { PATCH } = await import('@/app/api/orders/[orderId]/route');
    const response = await PATCH(
      new Request('http://test/api/orders/order-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COMPLETED' }),
      }),
      { params: Promise.resolve({ orderId: 'order-1' }) },
    );
    expect(response.status).toBe(404);
    expect(db.prisma.order.update).not.toHaveBeenCalled();
  });
});

describe('dashboard overview route', () => {
  it('requires authentication at the route boundary', async () => {
    auth.requireAuth.mockRejectedValueOnce(
      Response.json({ error: 'Unauthorized' }, { status: 401 }),
    );
    const { GET } = await import('@/app/api/dashboard/overview/route');
    const response = await GET(new Request('http://test/api/dashboard/overview'));
    expect(response.status).toBe(401);
    expect(db.prisma.order.aggregate).not.toHaveBeenCalled();
  });

  it('sums outstanding and recovered money in one typed payload', async () => {
    db.prisma.order.aggregate
      .mockResolvedValueOnce({ _sum: { amountPesewas: 4550 }, _count: 2 })
      .mockResolvedValueOnce({ _sum: { amountPesewas: 20000 }, _count: 4 });
    db.prisma.order.findFirst.mockResolvedValue(order);
    db.prisma.order.findMany.mockResolvedValue([
      { ...order, customer: { id: 'customer-1', name: 'Ama', phone: '0241112200' } },
    ]);
    const { GET } = await import('@/app/api/dashboard/overview/route');
    const response = await GET(new Request('http://test/api/dashboard/overview'));
    expect(response.status).toBe(200);
    expect(db.prisma.order.aggregate).toHaveBeenCalledTimes(2);
    await expect(response.json()).resolves.toMatchObject({
      outstandingPesewas: 4550,
      outstandingCount: 2,
      oldestOutstandingDays: expect.any(Number),
      recoveredMonthPesewas: 20000,
      recoveredMonthCount: 4,
      topChases: [
        { orderNumber: order.orderNumber, customerName: 'Ama', customerPhone: '0241112200' },
      ],
    });
  });
});

describe('store routes', () => {
  const store = {
    id: 'store-1',
    name: "Ama's Boutique",
    slug: 'amas-boutique',
    tagline: null,
    description: null,
    promoBanner: null,
    contactPhone: '024 000 0000',
    active: true,
    createdAt: new Date('2026-09-21T00:00:00.000Z'),
    updatedAt: new Date('2026-09-21T00:00:00.000Z'),
  };
  const item = {
    id: 'item-1',
    storeId: 'store-1',
    kind: 'PRODUCT' as const,
    name: 'Branded apron',
    description: null,
    pricePesewas: 4550,
    costPricePesewas: null,
    compareAtPricePesewas: null,
    sortOrder: 0,
    active: true,
    createdAt: new Date('2026-09-21T00:00:00.000Z'),
    updatedAt: new Date('2026-09-21T00:00:00.000Z'),
  };

  it('creates the workspace store on first save', async () => {
    db.prisma.store.findUnique.mockResolvedValue(null);
    db.prisma.store.create.mockResolvedValue({ ...store, items: [] });
    const { PUT } = await import('@/app/api/store/route');
    const response = await PUT(
      new Request('http://test/api/store', {
        method: 'PUT',
        body: JSON.stringify({
          name: store.name,
          slug: store.slug,
          contactPhone: store.contactPhone,
          active: true,
        }),
      }),
    );
    expect(response.status).toBe(200);
    // One storefront per account: the owner is stamped from the session, keyed by
    // the unique Store.userId, never taken from the body.
    expect(db.prisma.store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'amas-boutique', userId: 'staff-1' }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      id: 'store-1',
      slug: 'amas-boutique',
      items: [],
    });
  });

  it("cannot claim another shop's storefront on a second save", async () => {
    db.prisma.store.findUnique.mockResolvedValue(store);
    db.prisma.store.update.mockResolvedValue({ ...store, items: [] });
    const { PUT } = await import('@/app/api/store/route');
    const response = await PUT(
      new Request('http://test/api/store', {
        method: 'PUT',
        body: JSON.stringify({ name: store.name, slug: store.slug, active: true }),
      }),
    );
    expect(response.status).toBe(200);
    expect(db.prisma.store.create).not.toHaveBeenCalled();
    expect(db.prisma.store.update).toHaveBeenCalled();
  });

  it('rejects an invalid store link word', async () => {
    const { PUT } = await import('@/app/api/store/route');
    const response = await PUT(
      new Request('http://test/api/store', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Bad', slug: 'Bad Link!' }),
      }),
    );
    expect(response.status).toBe(400);
    expect(db.prisma.store.create).not.toHaveBeenCalled();
  });

  it('blocks items until a store exists', async () => {
    db.prisma.store.findUnique.mockResolvedValue(null);
    const { POST } = await import('@/app/api/store/items/route');
    const response = await POST(
      new Request('http://test/api/store/items', {
        method: 'POST',
        body: JSON.stringify({ name: 'Apron', pricePesewas: 4550 }),
      }),
    );
    expect(response.status).toBe(409);
    expect(db.prisma.storeItem.create).not.toHaveBeenCalled();
  });

  it('adds an item to an existing store', async () => {
    db.prisma.store.findUnique.mockResolvedValue(store);
    db.prisma.storeItem.create.mockResolvedValue(item);
    const { POST } = await import('@/app/api/store/items/route');
    const response = await POST(
      new Request('http://test/api/store/items', {
        method: 'POST',
        body: JSON.stringify({ name: 'Branded apron', pricePesewas: 4550 }),
      }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      id: 'item-1',
      storeId: 'store-1',
      kind: 'PRODUCT',
      pricePesewas: 4550,
    });
  });

  it("refuses to sell another shop's catalogue", async () => {
    db.prisma.store.findUnique.mockResolvedValue(store);
    db.prisma.storeItem.findMany.mockResolvedValue([]);
    const { POST } = await import('@/app/api/orders/route');
    db.prisma.customer.findFirst.mockResolvedValue(customer);
    const response = await POST(
      new Request('http://test/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 'customer-1',
          description: 'order',
          lines: [{ storeItemId: 'item-from-another-shop', quantity: 1 }],
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(db.prisma.storeItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ storeId: 'store-1' }) }),
    );
  });

  it('returns 404 when removing an unknown item', async () => {
    db.prisma.storeItem.findFirst.mockResolvedValue(null);
    const { DELETE } = await import('@/app/api/store/items/[itemId]/route');
    const response = await DELETE(new Request('http://test/api/store/items/missing'), {
      params: Promise.resolve({ itemId: 'missing' }),
    });
    expect(response.status).toBe(404);
    expect(db.prisma.storeItem.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete another shop's item", async () => {
    db.prisma.storeItem.findFirst.mockResolvedValue(null);
    const { DELETE } = await import('@/app/api/store/items/[itemId]/route');
    const response = await DELETE(new Request('http://test/api/store/items/item-1'), {
      params: Promise.resolve({ itemId: 'item-1' }),
    });
    expect(response.status).toBe(404);
    // Reached THROUGH the owner's store, so a guessed cuid can't be resolved.
    expect(db.prisma.storeItem.findFirst).toHaveBeenCalledWith({
      where: { id: 'item-1', store: { userId: 'staff-1' } },
    });
    expect(db.prisma.storeItem.delete).not.toHaveBeenCalled();
  });

  it('serves the public catalog only for live stores', async () => {
    db.prisma.store.findFirst.mockResolvedValue({ ...store, items: [item], promotions: [] });
    const { GET } = await import('@/app/api/public/store/[slug]/route');
    const response = await GET(new Request('http://test/api/public/store/amas-boutique'), {
      params: Promise.resolve({ slug: 'amas-boutique' }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      name: "Ama's Boutique",
      items: [{ id: 'item-1', name: 'Branded apron' }],
    });

    db.prisma.store.findFirst.mockResolvedValue(null);
    const missing = await GET(new Request('http://test/api/public/store/nope'), {
      params: Promise.resolve({ slug: 'nope' }),
    });
    expect(missing.status).toBe(404);
  });
});

describe('store post routes', () => {
  const itemWithStore = {
    id: 'item-1',
    storeId: 'store-1',
    kind: 'PRODUCT' as const,
    name: 'Branded apron',
    description: null,
    pricePesewas: 4550,
    costPricePesewas: null,
    compareAtPricePesewas: null,
    sortOrder: 0,
    active: true,
    createdAt: new Date('2026-09-21T00:00:00.000Z'),
    updatedAt: new Date('2026-09-21T00:00:00.000Z'),
  };
  const store = {
    id: 'store-1',
    name: "Ama's Boutique",
    slug: 'amas-boutique',
    tagline: null,
    description: null,
    contactPhone: '024 000 0000',
    active: true,
    createdAt: new Date('2026-09-21T00:00:00.000Z'),
    updatedAt: new Date('2026-09-21T00:00:00.000Z'),
  };
  const posted = {
    id: 'post-1',
    storeId: 'store-1',
    itemId: 'item-1',
    platform: 'TIKTOK' as const,
    status: 'SHARED' as const,
    caption: 'Branded apron\nGH₵ 45.50\nOrder at https://tilo.app/store/amas-boutique',
    externalUrl: null,
    createdAt: new Date('2026-09-22T00:00:00.000Z'),
    updatedAt: new Date('2026-09-22T00:00:00.000Z'),
    item: { name: 'Branded apron' },
  };

  it('logs a share and returns the typed record', async () => {
    db.prisma.storeItem.findFirst.mockResolvedValue(itemWithStore);
    db.prisma.storePost.create.mockResolvedValue(posted);
    const { POST } = await import('@/app/api/store/posts/route');
    const response = await POST(
      new Request('http://test/api/store/posts', {
        method: 'POST',
        body: JSON.stringify({ itemId: 'item-1', platform: 'TIKTOK', caption: posted.caption }),
      }),
    );
    expect(response.status).toBe(201);
    expect(db.prisma.storePost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ storeId: 'store-1', status: 'SHARED' }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      id: 'post-1',
      platform: 'TIKTOK',
      itemName: 'Branded apron',
    });
  });

  it('returns 404 when the item does not exist', async () => {
    db.prisma.storeItem.findFirst.mockResolvedValue(null);
    const { POST } = await import('@/app/api/store/posts/route');
    const response = await POST(
      new Request('http://test/api/store/posts', {
        method: 'POST',
        body: JSON.stringify({ itemId: 'missing', platform: 'INSTAGRAM', caption: 'hi' }),
      }),
    );
    expect(response.status).toBe(404);
    expect(db.prisma.storePost.create).not.toHaveBeenCalled();
  });

  it('rejects a share with no caption', async () => {
    const { POST } = await import('@/app/api/store/posts/route');
    const response = await POST(
      new Request('http://test/api/store/posts', {
        method: 'POST',
        body: JSON.stringify({ itemId: 'item-1', platform: 'TIKTOK', caption: '' }),
      }),
    );
    expect(response.status).toBe(400);
    expect(db.prisma.storePost.create).not.toHaveBeenCalled();
  });

  it('lists the publishing log newest first', async () => {
    db.prisma.store.findUnique.mockResolvedValue(store);
    db.prisma.storePost.findMany.mockResolvedValue([posted]);
    const { GET } = await import('@/app/api/store/posts/route');
    const response = await GET(new Request('http://test/api/store/posts'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [{ id: 'post-1', itemName: 'Branded apron' }],
    });
  });

  it('marks a shared push as posted with its link', async () => {
    db.prisma.storePost.findFirst.mockResolvedValue(posted);
    db.prisma.storePost.update.mockResolvedValue({
      ...posted,
      status: 'PUBLISHED',
      externalUrl: 'https://www.tiktok.com/@amas/video/1',
    });
    const { PATCH } = await import('@/app/api/store/posts/[postId]/route');
    const response = await PATCH(
      new Request('http://test/api/store/posts/post-1', {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'PUBLISHED',
          externalUrl: 'https://www.tiktok.com/@amas/video/1',
        }),
      }),
      { params: Promise.resolve({ postId: 'post-1' }) },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'PUBLISHED',
      externalUrl: 'https://www.tiktok.com/@amas/video/1',
    });
  });

  it('returns 404 when removing an unknown push', async () => {
    db.prisma.storePost.findFirst.mockResolvedValue(null);
    const { DELETE } = await import('@/app/api/store/posts/[postId]/route');
    const response = await DELETE(new Request('http://test/api/store/posts/missing'), {
      params: Promise.resolve({ postId: 'missing' }),
    });
    expect(response.status).toBe(404);
    expect(db.prisma.storePost.delete).not.toHaveBeenCalled();
  });

  it("refuses to touch another shop's push log", async () => {
    db.prisma.storePost.findFirst.mockResolvedValue(null);
    const { PATCH } = await import('@/app/api/store/posts/[postId]/route');
    const response = await PATCH(
      new Request('http://test/api/store/posts/post-1', {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'PUBLISHED',
          externalUrl: 'https://www.tiktok.com/@amas/video/1',
        }),
      }),
      { params: Promise.resolve({ postId: 'post-1' }) },
    );
    expect(response.status).toBe(404);
    expect(db.prisma.storePost.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'post-1', store: { userId: 'staff-1' } } }),
    );
    expect(db.prisma.storePost.update).not.toHaveBeenCalled();
  });
});
