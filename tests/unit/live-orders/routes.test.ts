// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ requireAuth: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    customer: { findFirst: vi.fn(), create: vi.fn() },
    store: { findFirst: vi.fn() },
    storeItem: { findFirst: vi.fn() },
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

describe('public order placement', () => {
  it('places an order and creates the customer from the phone', async () => {
    db.prisma.store.findFirst.mockResolvedValue(store);
    db.prisma.storeItem.findFirst.mockResolvedValue(item);
    db.prisma.customer.findFirst.mockResolvedValue(null);
    db.prisma.customer.create.mockResolvedValue(newCustomer);
    db.prisma.order.create.mockResolvedValue(order);

    const { POST } = await import('@/app/api/public/store/[slug]/orders/route');
    const response = await POST(
      new Request('http://test/api/public/store/test/orders', {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'item-1',
          quantity: 1,
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
    expect(db.prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '+233241112200' }),
      }),
    );
    expect(db.prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'ORDER_PLACED',
          customerId: 'customer-1',
          orderId: 'order-1',
        }),
      }),
    );
  });

  it('reuses an existing regular instead of duplicating them', async () => {
    db.prisma.store.findFirst.mockResolvedValue(store);
    db.prisma.storeItem.findFirst.mockResolvedValue(item);
    db.prisma.customer.findFirst.mockResolvedValue(existingCustomer);
    db.prisma.order.create.mockResolvedValue(order);

    const { POST } = await import('@/app/api/public/store/[slug]/orders/route');
    const response = await POST(
      new Request('http://test/api/public/store/test/orders', {
        method: 'POST',
        body: JSON.stringify({ itemId: 'item-1', customerName: 'Ama', phone: '024 111 2200' }),
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
        body: JSON.stringify({ itemId: 'item-1', quantity: 1, customerName: '', phone: '' }),
      }),
      { params: Promise.resolve({ slug: 'test' }) },
    );
    expect(response.status).toBe(400);
    expect(db.prisma.order.create).not.toHaveBeenCalled();
  });

  it('keeps the stove cold for a missing item', async () => {
    db.prisma.store.findFirst.mockResolvedValue(store);
    db.prisma.storeItem.findFirst.mockResolvedValue(null);
    const { POST } = await import('@/app/api/public/store/[slug]/orders/route');
    const response = await POST(
      new Request('http://test/api/public/store/test/orders', {
        method: 'POST',
        body: JSON.stringify({ itemId: 'gone', customerName: 'Ama', phone: '024 111 2200' }),
      }),
      { params: Promise.resolve({ slug: 'test' }) },
    );
    expect(response.status).toBe(404);
    expect(db.prisma.order.create).not.toHaveBeenCalled();
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
    expect(db.prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { readAt: null } }),
    );
  });
});

describe('owner SMS dispatch', () => {
  it('sends a manual text and raises an SMS_SENT ping', async () => {
    sms.sendSms.mockResolvedValue({ ok: true, providerRef: 'ref-1', error: null });
    const { POST } = await import('@/app/api/sms/send/route');
    const response = await POST(
      new Request('http://test/api/sms/send', {
        method: 'POST',
        body: JSON.stringify({ to: '024 111 2200', message: 'Hello Ama!', template: 'Welcome' }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, providerRef: 'ref-1' });
    expect(sms.sendSms).toHaveBeenCalledWith('024 111 2200', 'Hello Ama!', 'MANUAL');
    expect(db.prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'SMS_SENT' }),
      }),
    );
  });

  it('surfaces provider failures as an SMS_FAILED ping', async () => {
    sms.sendSms.mockResolvedValue({ ok: false, providerRef: null, error: 'low balance' });
    const { POST } = await import('@/app/api/sms/send/route');
    const response = await POST(
      new Request('http://test/api/sms/send', {
        method: 'POST',
        body: JSON.stringify({ to: '024 111 2200', message: 'Hello Ama!' }),
      }),
    );
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('low balance');
    expect(db.prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'SMS_FAILED' }),
      }),
    );
  });

  it('rejects messages over the single-SMS cap before ringing the provider', async () => {
    const { POST } = await import('@/app/api/sms/send/route');
    const response = await POST(
      new Request('http://test/api/sms/send', {
        method: 'POST',
        body: JSON.stringify({ to: '024 111 2200', message: 'x'.repeat(321) }),
      }),
    );
    expect(response.status).toBe(400);
    expect(sms.sendSms).not.toHaveBeenCalled();
  });
});
