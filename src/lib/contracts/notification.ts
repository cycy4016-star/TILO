// Client-safe notification contracts shared by the feed routes and the bell
// island. Single-tenant: notifications belong to the one store.
import { z } from 'zod';

export const NotificationKind = z.enum([
  'VISITOR_CAPTURED',
  'ORDER_PLACED',
  'SMS_SENT',
  'SMS_FAILED',
]);

export const NotificationRecord = z.object({
  id: z.string(),
  kind: NotificationKind,
  title: z.string(),
  message: z.string().nullable(),
  customerId: z.string().nullable(),
  orderId: z.string().nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// The bell payload: newest items + how many are still unread.
export const NotificationFeed = z.object({
  items: z.array(NotificationRecord),
  unreadCount: z.number().int().nonnegative(),
});

export const NotificationReadResult = z.object({ unreadCount: z.number().int().nonnegative() });

export type NotificationKindValue = z.infer<typeof NotificationKind>;
export type NotificationRecord = z.infer<typeof NotificationRecord>;
export type NotificationFeed = z.infer<typeof NotificationFeed>;
