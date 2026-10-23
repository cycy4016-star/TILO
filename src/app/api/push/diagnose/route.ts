// Safe push-readiness readout for the signed-in owner: are both VAPID keys
// present, do they parse, and how many browsers are subscribed? The private key
// is never returned.
import 'server-only';

import { NextResponse } from 'next/server';
import { PushDiagnostics } from '@/lib/contracts/push';
import { prisma } from '@/lib/db';
import { pushConfigurationStatus } from '@/lib/push';
import { requireAuth } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const status = await pushConfigurationStatus();
    const subscriptions = await prisma.pushSubscription.count({ where: { userId: user.id } });
    return NextResponse.json(PushDiagnostics.parse({ ...status, subscriptions }));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
