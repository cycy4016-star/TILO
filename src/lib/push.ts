import 'server-only';

import { type PushPayload, PushPayload as PushPayloadSchema } from '@/lib/contracts/push';
import { prisma } from '@/lib/db';

export type PushSendResult = {
  sent: number;
  failed: number;
  removed: number;
};

const EMPTY_RESULT: PushSendResult = { sent: 0, failed: 0, removed: 0 };

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

async function pushClient() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  const webpush = await import('web-push');
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:no-reply@tilza.org',
    publicKey,
    privateKey,
  );
  return webpush;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  try {
    const webpush = await pushClient();
    if (!webpush) return EMPTY_RESULT;

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    return sendToSubscriptions(webpush, subscriptions, payload, async (id) => {
      await prisma.pushSubscription.deleteMany({ where: { id, userId } });
    });
  } catch {
    return EMPTY_RESULT;
  }
}

export async function sendPushToCourier(
  courierId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  try {
    const webpush = await pushClient();
    if (!webpush) return EMPTY_RESULT;

    const subscriptions = await prisma.courierPushSubscription.findMany({
      where: { courierId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    return sendToSubscriptions(webpush, subscriptions, payload, async (id) => {
      await prisma.courierPushSubscription.deleteMany({ where: { id, courierId } });
    });
  } catch {
    return EMPTY_RESULT;
  }
}

export async function sendPushToOrder(
  orderId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  try {
    const webpush = await pushClient();
    if (!webpush) return EMPTY_RESULT;

    const subscriptions = await prisma.orderPushSubscription.findMany({
      where: { orderId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    return sendToSubscriptions(webpush, subscriptions, payload, async (id) => {
      await prisma.orderPushSubscription.deleteMany({ where: { id, orderId } });
    });
  } catch {
    return EMPTY_RESULT;
  }
}

type WebPush = Awaited<ReturnType<typeof pushClient>>;
type StoredSubscription = { id: string; endpoint: string; p256dh: string; auth: string };

async function sendToSubscriptions(
  webpush: NonNullable<WebPush>,
  subscriptions: StoredSubscription[],
  payload: PushPayload,
  remove: (id: string) => Promise<void>,
): Promise<PushSendResult> {
  const body = JSON.stringify(PushPayloadSchema.parse(payload));
  const outcomes = await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
          { TTL: 60 * 60 * 24, urgency: 'normal' },
        );
        return 'sent' as const;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          try {
            await remove(subscription.id);
            return 'removed' as const;
          } catch {
            return 'failed' as const;
          }
        }
        return 'failed' as const;
      }
    }),
  );

  const result: PushSendResult = { ...EMPTY_RESULT };
  for (const outcome of outcomes) result[outcome] += 1;
  return result;
}
