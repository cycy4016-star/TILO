// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ requireAuth: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    customer: { findFirst: vi.fn(), create: vi.fn() },
    store: { findFirst: vi.fn() },
    storeItem: { findMany: vi.fn(), findFirst: vi.fn() },
    order: { create: vi.fn() },
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));
const sms = vi.hoisted(() => ({ sendSms: vi.fn() }));

vi.mock('@/lib/require-auth', () => auth);
vi.mock('@/lib/db', () => db);
vi.mock('@/lib/sms', () => sms);
vi.mock('server-only', () => ({}));

const store = {
  id: 'store-1',
  // The owner the public routes file every capture under — resolved from the
  // storefront's own row, never from the visitor's request.
  userId: 'owner-1',
  name: 'Kente Kitchen',
  slug: 'test',
  active: true,
};
const item = {
  id: 'item-1',
  storeId: 'store-1',
  name: 'Branded apron',
  active: true,
};
const newCustomer = { id: 'customer-1', name: 'Ama', phone: '+233241112200', address: null };
const existingCustomer = { id: 'customer-9', name: 'Ama', phone: '+233241112200', address: 'Osu' };
const order = {
  id: 'order-1',
  orderNumber: 'TILO-20260922-A1B2C3D4',
  customerId: 'customer-1',
  description: '1x Branded apron',
  status: 'PENDING' as const,
  amountPesewas: null,
  paidAt: null,
  createdAt: new Date('2026-09-22T00:00:00.000Z'),
  updatedAt: new Date('2026-09-22T00:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireAuth.mockResolvedValue({ id: 'staff-1', email: 'staff@example.test' });
});

// The public capture routes rate-limit per IP (5/min). Every order request here
// claims to come from a different visitor, so the suite never trips its own
// limiter no matter how many cases it grows to.
let visitorCount = 0;
function visitorIp() {
  visitorCount += 1;
  return `203.0.113.${visitorCount}`;
}

describe('public order placement', () => {
  it('places an order and creates the customer from the phone', async () => {
    db.prisma.store.findFirst.mockResolvedValue(store);
    db.prisma.storeItem.findMany.mockResolvedValue([item]);
    db.prisma.customer.findFirst.mockResolvedValue(null);
    db.prisma.customer.create.mockResolvedValue(newCustomer);
    db.prisma.order.create.mockResolvedValue(order);

    const { POST } = await import('@/app/api/public/store/[slug]/orders/route');
    const response = await POST(
      new Request('http://test/api/public/store/test/orders', {
        method: 'POST',
        headers: { 'x-forwarded-for': visitorIp() },
        body: JSON.stringify({
          lines: [{ itemId: 'item-1', quantity: 1 }],
          customerName: 'Ama',
          phone: '024 111 2200',
        }),
      }),
      { params: Promise.resolve({ slug: 'test' }) },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.order.orderNumber).toBe('TILO-20260922-A1B2C3D4');
    expect(body.createdCustomer).toBe(true);
    // Everything the public flow writes is filed under the storefront's owner.
    expect(db.prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'owner-1' }) }),
    );
    expect(db.prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '+233241112200', userId: 'owner-1' }),
      }),
    );
    expect(db.prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'owner-1', customerId: 'customer-1' }),
      }),
    );
    expect(db.prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'owner-1',
          kind: 'ORDER_PLACED',
          customerId: 'customer-1',
          orderId: 'order-1',
        }),
      }),
    );
  });

  it('keeps the same phone separate across two shops', async () => {
    // The wall lookup is scoped by owner, so a customer of shop A is never
    // reused as shop B's customer (which would leak A's address and history).
    db.prisma.store.findFirst.mockResolvedValue(store);
    db.prisma.storeItem.findMany.mockResolvedValue([item]);
    db.prisma.customer.findFirst.mockResolvedValue(null);
    db.prisma.customer.create.mockResolvedValue(newCustomer);
    db.prisma.order.create.mockResolvedValue(order);

    const { POST } = await import('@/app/api/public/store/[slug]/orders/route');
    await POST(
      new Request('http://test/api/public/store/test/orders', {
        method: 'POST',
        headers: { 'x-forwarded-for': visitorIp() },
        body: JSON.stringify({
          lines: [{ itemId: 'item-1' }],
          customerName: 'Ama',
          phone: '024 111 2200',
        }),
      }),
      { params: Promise.resolve({ slug: 'test' }) },
    );
    expect(db.prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { phone: '+233241112200', userId: 'owner-1' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('reuses an existing regular instead of duplicating them', async () => {
    db.prisma.store.findFirst.mockResolvedValue(store);
    db.prisma.storeItem.findMany.mockResolvedValue([item]);
    db.prisma.customer.findFirst.mockResolvedValue(existingCustomer);
    db.prisma.order.create.mockResolvedValue(order);

    const { POST } = await import('@/app/api/public/store/[slug]/orders/route');
    const response = await POST(
      new Request('http://test/api/public/store/test/orders', {
        method: 'POST',
        headers: { 'x-forwarded-for': visitorIp() },
        body: JSON.stringify({
          lines: [{ itemId: 'item-1' }],
          customerName: 'Ama',
          phone: '024 111 2200',
        }),
      }),
      { params: Promise.resolve({ slug: 'test' }) },
    );

    expect(response.status).toBe(201);
    expect((await response.json()).createdCustomer).toBe(false);
    expect(db.prisma.customer.create).not.toHaveBeenCalled();
  });

  it('rejects visitors without a usable name or phone', async () => {
    const { POST } = await import('@/app/api/public/store/[slug]/orders/route');
    const response = await POST(
      new Request('http://test/api/public/store/test/orders', {
        method: 'POST',
        headers: { 'x-forwarded-for': visitorIp() },
        body: JSON.stringify({
          lines: [{ itemId: 'item-1', quantity: 1 }],
          customerName: '',
          phone: '',
        }),
      }),
      { params: Promise.resolve({ slug: 'test' }) },
    );
    expect(response.status).toBe(400);
    expect(db.prisma.order.create).not.toHaveBeenCalled();
  });

  it('keeps the stove cold for a missing item', async () => {
    db.prisma.store.findFirst.mockResolvedValue(store);
    db.prisma.storeItem.findMany.mockResolvedValue([]);
    const { POST } = await import('@/app/api/public/store/[slug]/orders/route');
    const response = await POST(
      new Request('http://test/api/public/store/test/orders', {
        method: 'POST',
        headers: { 'x-forwarded-for': visitorIp() },
        body: JSON.stringify({
          lines: [{ itemId: 'gone' }],
          customerName: 'Ama',
          phone: '024 111 2200',
        }),
      }),
      { params: Promise.resolve({ slug: 'test' }) },
    );
    expect(response.status).toBe(404);
    expect(db.prisma.order.create).not.toHaveBeenCalled();
  });

  it('prices a multi-line basket and snapshots every line', async () => {
    const basketItem = {
      id: 'item-2',
      storeId: 'store-1',
      name: 'Kente scarf',
      active: true,
      pricePesewas: 2500,
      costPricePesewas: 1000,
    };
    const apron = { ...item, pricePesewas: 4550, costPricePesewas: 2000 };
    db.prisma.store.findFirst.mockResolvedValue(store);
    // One query resolves the whole basket, so a hidden product anywhere in it
    // fails the whole order instead of silently dropping a line.
    db.prisma.storeItem.findMany.mockResolvedValue([apron, basketItem]);
    db.prisma.customer.findFirst.mockResolvedValue(existingCustomer);
    db.prisma.order.create.mockResolvedValue({ ...order, amountPesewas: 11600 });

    const { POST } = await import('@/app/api/public/store/[slug]/orders/route');
    const response = await POST(
      new Request('http://test/api/public/store/test/orders', {
        method: 'POST',
        headers: { 'x-forwarded-for': visitorIp() },
        body: JSON.stringify({
          lines: [
            { itemId: 'item-1', quantity: 2 },
            { itemId: 'item-2', quantity: 1 },
          ],
          customerName: 'Ama',
          phone: '024 111 2200',
        }),
      }),
      { params: Promise.resolve({ slug: 'test' }) },
    );

    expect(response.status).toBe(201);
    expect(db.prisma.storeItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storeId: 'store-1',
          active: true,
          id: { in: ['item-1', 'item-2'] },
        }),
      }),
    );
    expect(db.prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          // 2 x 45.50 + 1 x 25.00
          amountPesewas: 11600,
          description: '2x Branded apron, 1x Kente scarf',
          lines: {
            create: [
              expect.objectContaining({
                storeItemId: 'item-1',
                quantity: 2,
                unitPricePesewas: 4550,
              }),
              expect.objectContaining({
                storeItemId: 'item-2',
                quantity: 1,
                unitPricePesewas: 2500,
              }),
            ],
          },
        }),
      }),
    );
  });
});

describe('public lead capture', () => {
  it('never saves a visitor who has not opted in', async () => {
    const { POST } = await import('@/app/api/public/store/[slug]/leads/route');
    const response = await POST(
      new Request('http://test/api/public/store/test/leads', {
        method: 'POST',
        body: JSON.stringify({ name: 'Ama', phone: '024 111 2200', consent: false }),
      }),
      { params: Promise.resolve({ slug: 'test' }) },
    );
    expect(response.status).toBe(400);
    expect(db.prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('captures a consenting visitor into the wall and rings the bell', async () => {
    db.prisma.store.findFirst.mockResolvedValue(store);
    db.prisma.customer.findFirst.mockResolvedValue(null);
    db.prisma.customer.create.mockResolvedValue(newCustomer);
    const { POST } = await import('@/app/api/public/store/[slug]/leads/route');
    const response = await POST(
      new Request('http://test/api/public/store/test/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Ama',
          phone: '024 111 2200',
          town: 'Legon',
          note: 'Aprons for a launch',
          consent: true,
        }),
      }),
      { params: Promise.resolve({ slug: 'test' }) },
    );
    expect(response.status).toBe(201);
    expect((await response.json()).created).toBe(true);
    expect(db.prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '+233241112200', address: 'Legon' }),
      }),
    );
    expect(db.prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'VISITOR_CAPTURED' }),
      }),
    );
  });

  it('lets honeypot bots off without saving anything', async () => {
    const { POST } = await import('@/app/api/public/store/[slug]/leads/route');
    const response = await POST(
      new Request('http://test/api/public/store/test/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Ama',
          phone: '024 111 2200',
          website: 'http://spam.example',
          consent: true,
        }),
      }),
      { params: Promise.resolve({ slug: 'test' }) },
    );
    expect(response.status).toBe(201);
    expect(db.prisma.customer.findFirst).not.toHaveBeenCalled();
    expect(db.prisma.notification.create).not.toHaveBeenCalled();
  });
});

describe('notification feed', () => {
  it('lists the newest items with the unread tally', async () => {
    db.prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n-1',
        kind: 'ORDER_PLACED',
        title: 'New order — Apron',
        message: 'Ama (+233241112200) ordered 1x Branded apron.',
        customerId: 'customer-1',
        orderId: 'order-1',
        readAt: null,
        createdAt: new Date('2026-09-22T00:00:00.000Z'),
        updatedAt: new Date('2026-09-22T00:00:00.000Z'),
      },
    ]);
    db.prisma.notification.count.mockResolvedValue(3);
    const { GET } = await import('@/app/api/notifications/route');
    const response = await GET(new Request('http://test/api/notifications'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      unreadCount: 3,
      items: [{ id: 'n-1', kind: 'ORDER_PLACED' }],
    });
    // The bell and its unread tally are both scoped to the signed-in shop.
    expect(db.prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'staff-1' } }),
    );
    expect(db.prisma.notification.count).toHaveBeenCalledWith({
      where: { userId: 'staff-1', readAt: null },
    });
  });

  it('requires auth before spilling the feed', async () => {
    auth.requireAuth.mockRejectedValueOnce(
      Response.json({ error: 'Unauthorized' }, { status: 401 }),
    );
    const { GET } = await import('@/app/api/notifications/route');
    const response = await GET(new Request('http://test/api/notifications'));
    expect(response.status).toBe(401);
    expect(db.prisma.notification.findMany).not.toHaveBeenCalled();
  });

  it('marks everything read on the Got-it sweep', async () => {
    db.prisma.notification.updateMany.mockResolvedValue({ count: 5 });
    const { POST } = await import('@/app/api/notifications/read/route');
    const response = await POST(
      new Request('http://test/api/notifications/read', { method: 'POST' }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ unreadCount: 0 });
    // Clears this shop's badge only — never another shop's.
    expect(db.prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'staff-1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
