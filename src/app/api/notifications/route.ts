// In-app activity feed: the newest notifications + how many are unread. Feeds
// the dashboard bell (polls every ~15s) — orders placed on the storefront,
// visitors captured, SMS sent or failed.
import 'server-only';

import { NextResponse } from 'next/server';
import { NotificationFeed } from '@/lib/contracts/notification';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    // Tenancy: the bell is this shop's own feed.
    const where = { userId: user.id };
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return NextResponse.json(
      NotificationFeed.parse({
        items: items.map((item) => ({
          id: item.id,
          kind: item.kind,
          title: item.title,
          message: item.message,
          customerId: item.customerId,
          orderId: item.orderId,
          readAt: item.readAt ? item.readAt.toISOString() : null,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
        unreadCount,
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
