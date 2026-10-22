// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const webpush = vi.hoisted(() => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));
const db = vi.hoisted(() => ({
  prisma: {
    pushSubscription: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('web-push', () => webpush);
vi.mock('@/lib/db', () => db);
vi.mock('server-only', () => ({}));

const subscription = {
  id: 'sub-1',
  endpoint: 'https://push.example.test/one',
  p256dh: 'browser-key',
  auth: 'browser-auth',
};

const payload = {
  title: 'New order',
  body: 'Ama ordered a kente scarf.',
  url: '/dashboard/orders',
  tag: 'order-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VAPID_PUBLIC_KEY = 'test-public-key';
  process.env.VAPID_PRIVATE_KEY = 'test-private-key';
  process.env.VAPID_SUBJECT = 'mailto:test@example.test';
  db.prisma.pushSubscription.findMany.mockResolvedValue([subscription]);
  db.prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
  webpush.sendNotification.mockResolvedValue({ statusCode: 201 });
});

afterEach(() => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
});

describe('sendPushToUser', () => {
  it('does nothing until VAPID keys are configured', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const { sendPushToUser } = await import('@/lib/push');
    const result = await sendPushToUser('user-1', payload);
    expect(result).toEqual({ sent: 0, failed: 0, removed: 0 });
    expect(db.prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('sends the payload to every subscription for the owner', async () => {
    const { sendPushToUser } = await import('@/lib/push');
    const result = await sendPushToUser('user-1', payload);
    expect(result).toEqual({ sent: 1, failed: 0, removed: 0 });
    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      'mailto:test@example.test',
      'test-public-key',
      'test-private-key',
    );
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24, urgency: 'normal' },
    );
  });

  it('removes subscriptions the push service says are gone', async () => {
    webpush.sendNotification.mockRejectedValue({ statusCode: 410 });
    const { sendPushToUser } = await import('@/lib/push');
    const result = await sendPushToUser('user-1', payload);
    expect(result).toEqual({ sent: 0, failed: 0, removed: 1 });
    expect(db.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: subscription.id, userId: 'user-1' },
    });
  });

  it('keeps subscriptions when the push service has a transient failure', async () => {
    webpush.sendNotification.mockRejectedValue({ statusCode: 503 });
    const { sendPushToUser } = await import('@/lib/push');
    const result = await sendPushToUser('user-1', payload);
    expect(result).toEqual({ sent: 0, failed: 1, removed: 0 });
    expect(db.prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it('never breaks the caller when the database is unavailable', async () => {
    db.prisma.pushSubscription.findMany.mockRejectedValue(new Error('db down'));
    const { sendPushToUser } = await import('@/lib/push');
    const result = await sendPushToUser('user-1', payload);
    expect(result).toEqual({ sent: 0, failed: 0, removed: 0 });
  });
});
