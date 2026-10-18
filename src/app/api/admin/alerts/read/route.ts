// Marks the caller's alerts read — opening the ALERTS panel clears the badge,
// exactly like reading a chat clears its unread count. Admin-only.
import 'server-only';

import { NextResponse } from 'next/server';
import { AlertsReadResult } from '@/lib/contracts/admin-alerts';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    await prisma.adminAlert.updateMany({
      where: { userId: admin.id, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json(AlertsReadResult.parse({ unread: 0 }));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
