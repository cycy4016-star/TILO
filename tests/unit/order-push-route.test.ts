// @vitest-environment node
// Buyer push subscriptions are scoped per order. One browser following two
// orders must keep both rows; the old global endpoint key silently moved the
// subscription from the first order to the second.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const tracking = vi.hoisted(() => ({ verifyOrderToken: vi.fn() }));
const push = vi.hoisted(() => ({ isPushConfigured: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    orderPushSubscription: {
      count: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/order-tracking', () => tracking);
vi.mock('@/lib/push', () => push);
vi.mock('@/lib/db', () => db);

const endpoint = 'https://push.example.test/browser';
const subscription = {
  endpoint,
  keys: { p256dh: 'browser-key', auth: 'browser-auth' },
};

function request(method: string, body?: unknown) {
  return new Request('http://test/api/public/orders/token/push', {
    method,
    headers: { 'content-type': 'application/json', 'user-agent': 'Vitest Browser' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function context(token: string) {
  return { params: Promise.resolve({ token }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VAPID_PUBLIC_KEY = 'test-public-key';
  tracking.verifyOrderToken.mockImplementation((token: string) =>
    token === 'token-a' ? 'order-a' : token === 'token-b' ? 'order-b' : null,
  );
  push.isPushConfigured.mockReturnValue(true);
  db.prisma.orderPushSubscription.count.mockResolvedValue(1);
  db.prisma.orderPushSubscription.upsert.mockResolvedValue({});
  db.prisma.orderPushSubscription.deleteMany.mockResolvedValue({ count: 1 });
});

describe('buyer order push route', () => {
  it('keeps the same endpoint subscribed to two different orders', async () => {
    const { POST } = await import('@/app/api/public/orders/[token]/push/route');

    const first = await POST(request('POST', subscription), context('token-a'));
    const second = await POST(request('POST', subscription), context('token-b'));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(db.prisma.orderPushSubscription.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { orderId_endpoint: { orderId: 'order-a', endpoint } },
        create: expect.objectContaining({ orderId: 'order-a', endpoint }),
      }),
    );
    expect(db.prisma.orderPushSubscription.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { orderId_endpoint: { orderId: 'order-b', endpoint } },
        create: expect.objectContaining({ orderId: 'order-b', endpoint }),
      }),
    );
  });

  it('deletes only the subscription for the order in the token', async () => {
    const { DELETE } = await import('@/app/api/public/orders/[token]/push/route');
    const response = await DELETE(request('DELETE', { endpoint }), context('token-a'));
    expect(response.status).toBe(200);
    expect(db.prisma.orderPushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint, orderId: 'order-a' },
    });
  });

  it('rejects a subscription for an unknown token before writing', async () => {
    const { POST } = await import('@/app/api/public/orders/[token]/push/route');
    const response = await POST(request('POST', subscription), context('nope'));
    expect(response.status).toBe(404);
    expect(db.prisma.orderPushSubscription.upsert).not.toHaveBeenCalled();
  });
});
