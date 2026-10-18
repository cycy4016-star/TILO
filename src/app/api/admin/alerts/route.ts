// Operator alert feed: the terminal's ALERTS panel polls this. The GET first
// flushes any digest windows that have closed since the last poll (that is how
// hourly/daily cadences materialise without a cron), then returns the newest
// alerts, the unread count for the badge, and the caller's effective rules.
// Admin-only.
import 'server-only';

import { NextResponse } from 'next/server';
import { flushDueAdminAlerts, listAdminAlertSettings } from '@/lib/admin-alerts';
import { AlertsFeed } from '@/lib/contracts/admin-alerts';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

const LIMIT = 50;

export async function GET(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    await flushDueAdminAlerts();

    const [alerts, unread, settings] = await Promise.all([
      prisma.adminAlert.findMany({
        where: { userId: admin.id },
        orderBy: { createdAt: 'desc' },
        take: LIMIT,
      }),
      prisma.adminAlert.count({ where: { userId: admin.id, readAt: null } }),
      listAdminAlertSettings(admin.id),
    ]);

    return NextResponse.json(
      AlertsFeed.parse({
        alerts: alerts.map((alert) => ({
          id: alert.id,
          kind: alert.kind,
          title: alert.title,
          body: alert.body,
          amountPesewas: alert.amountPesewas,
          count: alert.count,
          windowStart: alert.windowStart?.toISOString() ?? null,
          windowEnd: alert.windowEnd?.toISOString() ?? null,
          readAt: alert.readAt?.toISOString() ?? null,
          createdAt: alert.createdAt.toISOString(),
        })),
        unread,
        settings,
        generatedAt: new Date().toISOString(),
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
