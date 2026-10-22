// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ requireAuth: vi.fn() }));
const push = vi.hoisted(() => ({
  isPushConfigured: vi.fn(),
  sendPushToUser: vi.fn(),
}));
const db = vi.hoisted(() => ({
  prisma: {
    pushSubscription: {
      count: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/require-auth', () => auth);
vi.mock('@/lib/push', () => push);
vi.mock('@/lib/db', () => db);
vi.mock('server-only', () => ({}));

const subscription = {
  endpoint: 'https://push.example.test/one',
  keys: { p256dh: 'browser-key', auth: 'browser-auth' },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VAPID_PUBLIC_KEY = 'test-public-key';
  auth.requireAuth.mockResolvedValue({ id: 'user-1' });
  push.isPushConfigured.mockReturnValue(true);
  push.sendPushToUser.mockResolvedValue({ sent: 1, failed: 0, removed: 0 });
  db.prisma.pushSubscription.count.mockResolvedValue(1);
  db.prisma.pushSubscription.upsert.mockResolvedValue({});
  db.prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.EMAIL_PROVIDER;
  delete process.env.RESEND_API_KEY;
});

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(`http://test${url}`, {
    method,
    headers: { 'content-type': 'application/json', 'user-agent': 'Vitest Browser' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('push config route', () => {
  it('reports when push is not configured', async () => {
    push.isPushConfigured.mockReturnValue(false);
    const { GET } = await import('@/app/api/push/route');
    const response = await GET(new Request('http://test/api/push'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      configured: false,
      publicKey: null,
      subscribed: false,
      deviceCount: 0,
      emailConfigured: false,
    });
    expect(db.prisma.pushSubscription.count).not.toHaveBeenCalled();
  });

  it('returns the public key and device count for a configured deployment', async () => {
    const { GET } = await import('@/app/api/push/route');
    const response = await GET(new Request('http://test/api/push'));
    expect(await response.json()).toEqual({
      configured: true,
      publicKey: 'test-public-key',
      subscribed: true,
      deviceCount: 1,
      emailConfigured: false,
    });
    expect(db.prisma.pushSubscription.count).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });

  it('reports when the email fallback is actually configured', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_test';
    const { GET } = await import('@/app/api/push/route');
    const response = await GET(new Request('http://test/api/push'));
    expect((await response.json()).emailConfigured).toBe(true);
  });
});

describe('push subscribe route', () => {
  it('stores the browser subscription for the signed-in owner', async () => {
    const { POST } = await import('@/app/api/push/subscribe/route');
    const response = await POST(jsonRequest('/api/push/subscribe', 'POST', subscription));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ subscribed: true });
    expect(db.prisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: subscription.endpoint },
      create: {
        userId: 'user-1',
        endpoint: subscription.endpoint,
        p256dh: 'browser-key',
        auth: 'browser-auth',
        userAgent: 'Vitest Browser',
      },
      update: {
        userId: 'user-1',
        p256dh: 'browser-key',
        auth: 'browser-auth',
        userAgent: 'Vitest Browser',
      },
    });
  });

  it('rejects an incomplete subscription', async () => {
    const { POST } = await import('@/app/api/push/subscribe/route');
    const response = await POST(
      jsonRequest('/api/push/subscribe', 'POST', { endpoint: subscription.endpoint }),
    );
    expect(response.status).toBe(400);
    expect(db.prisma.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  it('does not accept subscriptions until VAPID keys are configured', async () => {
    push.isPushConfigured.mockReturnValue(false);
    const { POST } = await import('@/app/api/push/subscribe/route');
    const response = await POST(jsonRequest('/api/push/subscribe', 'POST', subscription));
    expect(response.status).toBe(503);
    expect(db.prisma.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  it('deletes only the signed-in owner’s subscription', async () => {
    const { DELETE } = await import('@/app/api/push/subscribe/route');
    const response = await DELETE(
      jsonRequest('/api/push/subscribe', 'DELETE', { endpoint: subscription.endpoint }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ subscribed: false });
    expect(db.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: subscription.endpoint, userId: 'user-1' },
    });
  });
});

describe('push test route', () => {
  it('sends a test notification to the signed-in owner', async () => {
    const { POST } = await import('@/app/api/push/test/route');
    const response = await POST(jsonRequest('/api/push/test', 'POST'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: 1, failed: 0, removed: 0 });
    expect(push.sendPushToUser).toHaveBeenCalledWith('user-1', {
      title: 'Tilza notifications are on',
      body: 'New orders and your weekly shop summary will appear here.',
      url: '/dashboard',
      tag: 'tilza-test',
    });
  });
});
