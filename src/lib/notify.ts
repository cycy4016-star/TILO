// In-app notification writer. Server-only. Every event worth the owner seeing
// funnels through here so the bell feed and the databases stay in one shape.
// Never throws — a failed notification must not break the order/SMS that
// caused it.
import 'server-only';

import type { NotificationKind } from '@prisma/client';
import { prisma } from '@/lib/db';

export type NotifyInput = {
  kind: NotificationKind;
  title: string;
  message?: string | null;
  customerId?: string | null;
  orderId?: string | null;
};

export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        kind: input.kind,
        title: input.title,
        message: input.message ?? null,
        customerId: input.customerId ?? null,
        orderId: input.orderId ?? null,
      },
    });
  } catch {
    // The show must go on.
  }
}
