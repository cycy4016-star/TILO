// Sign out one courier device. Other devices keep their own session rows.
import 'server-only';

import { NextResponse } from 'next/server';
import { clearCourierCookie, getCourierSession } from '@/lib/courier-auth';
import { prisma } from '@/lib/db';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const context = await getCourierSession();
    if (context) {
      // A push endpoint is a device credential. Remove the rows bound to this
      // login (and any pre-binding rows for this rider) before the session is
      // gone, so a signed-out phone stops receiving job alerts.
      await prisma.courierPushSubscription
        .deleteMany({
          where: {
            courierId: context.courier.id,
            OR: [{ sessionId: context.session.id }, { sessionId: null }],
          },
        })
        .catch(() => undefined);
      await prisma.courierSession
        .delete({ where: { id: context.session.id } })
        .catch(() => undefined);
    }
    await clearCourierCookie();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
