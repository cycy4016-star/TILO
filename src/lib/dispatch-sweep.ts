// Time-based dispatch recovery. A broadcast that nobody accepts is widened
// once after 90 seconds, then flagged to the merchant after two minutes.
// Compare-and-set updates make the sweep safe to run from several app instances
// or an external cron at the same time.
import 'server-only';

import { prisma } from '@/lib/db';
import { dispatchOrder } from '@/lib/dispatch';
import { notify } from '@/lib/notify';
import { sendPushToUser } from '@/lib/push';

export const DISPATCH_WIDEN_AFTER_MS = 90_000;
export const DISPATCH_FALLBACK_AFTER_MS = 120_000;
export const DISPATCH_WIDEN_BY_KM = 5;
const BATCH = 25;

export type DispatchSweepResult = {
  checked: number;
  widened: number;
  fallback: number;
  skipped: number;
};

export async function sweepDispatches(now = new Date()): Promise<DispatchSweepResult> {
  const widenCutoff = new Date(now.getTime() - DISPATCH_WIDEN_AFTER_MS);
  const fallbackCutoff = new Date(now.getTime() - DISPATCH_FALLBACK_AFTER_MS);

  const candidates = await prisma.order.findMany({
    where: {
      fulfillmentMethod: 'LOCAL_DELIVERY',
      deliveryStatus: 'PENDING_DISPATCH',
      courierId: null,
      dispatchStartedAt: { lte: widenCutoff },
      dispatchFallbackAt: null,
    },
    orderBy: { dispatchStartedAt: 'asc' },
    take: BATCH,
    select: {
      id: true,
      userId: true,
      orderNumber: true,
      dispatchStartedAt: true,
      dispatchRadiusKm: true,
      dispatchWidenedAt: true,
      user: {
        select: {
          store: { select: { id: true, name: true, dispatchRadiusKm: true } },
        },
      },
    },
  });

  const result: DispatchSweepResult = {
    checked: candidates.length,
    widened: 0,
    fallback: 0,
    skipped: 0,
  };

  for (const order of candidates) {
    const startedAt = order.dispatchStartedAt;
    if (!startedAt) {
      result.skipped += 1;
      continue;
    }

    if (startedAt.getTime() <= fallbackCutoff.getTime()) {
      const claimed = await prisma.order.updateMany({
        where: {
          id: order.id,
          deliveryStatus: 'PENDING_DISPATCH',
          courierId: null,
          dispatchFallbackAt: null,
        },
        data: { dispatchFallbackAt: now },
      });
      if (claimed.count === 0) {
        result.skipped += 1;
        continue;
      }

      const storeName = order.user.store?.name ?? 'your shop';
      const message = `No rider accepted ${order.orderNumber} within two minutes. Dispatch again or handle it yourself.`;
      await prisma.deliveryEvent
        .create({
          data: {
            orderId: order.id,
            storeId: order.user.store?.id ?? null,
            type: 'DISPATCH_FALLBACK',
            actorType: 'SYSTEM',
            metadata: {
              radiusKm: order.dispatchRadiusKm ?? order.user.store?.dispatchRadiusKm ?? null,
              widened: order.dispatchWidenedAt != null,
            },
          },
        })
        .catch(() => undefined);
      await notify({
        userId: order.userId,
        kind: 'DELIVERY_ATTENTION',
        title: `Delivery needs you - ${order.orderNumber}`,
        message,
        orderId: order.id,
      });
      await sendPushToUser(order.userId, {
        title: `Delivery needs you - ${order.orderNumber}`.slice(0, 120),
        body: `${storeName}: ${message}`.slice(0, 480),
        url: '/dashboard/orders',
        tag: `dispatch-fallback-${order.id}`,
      });
      result.fallback += 1;
      continue;
    }

    if (order.dispatchWidenedAt) {
      result.skipped += 1;
      continue;
    }

    const currentRadius = Math.min(
      50,
      Math.max(1, order.dispatchRadiusKm ?? order.user.store?.dispatchRadiusKm ?? 5),
    );
    const nextRadius = Math.min(50, Math.max(currentRadius + DISPATCH_WIDEN_BY_KM, 10));

    // At the ceiling there is nowhere to widen, but the order still needs to
    // stop being selected on every sweep until the fallback fires.
    if (nextRadius <= currentRadius) {
      await prisma.order.updateMany({
        where: { id: order.id, dispatchWidenedAt: null, deliveryStatus: 'PENDING_DISPATCH' },
        data: { dispatchWidenedAt: now },
      });
      result.skipped += 1;
      continue;
    }

    const claimed = await prisma.order.updateMany({
      where: {
        id: order.id,
        deliveryStatus: 'PENDING_DISPATCH',
        courierId: null,
        dispatchWidenedAt: null,
        dispatchFallbackAt: null,
      },
      data: { dispatchWidenedAt: now },
    });
    if (claimed.count === 0) {
      result.skipped += 1;
      continue;
    }

    try {
      const widened = await dispatchOrder(order.id, { radiusKm: nextRadius });
      await prisma.deliveryEvent
        .create({
          data: {
            orderId: order.id,
            storeId: order.user.store?.id ?? null,
            type: 'DISPATCH_WIDENED',
            actorType: 'SYSTEM',
            metadata: {
              fromRadiusKm: currentRadius,
              toRadiusKm: widened.radiusKm,
              offers: widened.offers,
              onlineCouriers: widened.onlineCouriers,
            },
          },
        })
        .catch(() => undefined);
      result.widened += 1;
    } catch {
      // Accepted between the read and the claim, or a transient write failure.
      // Either way the next sweep sees the order's real state.
      result.skipped += 1;
    }
  }

  return result;
}
