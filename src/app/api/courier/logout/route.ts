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
