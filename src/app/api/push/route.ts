import 'server-only';

import { NextResponse } from 'next/server';
import { PushConfig } from '@/lib/contracts/push';
import { prisma } from '@/lib/db';
import { isMerchantEmailConfigured } from '@/lib/merchant-alerts';
import { pushConfigurationStatus } from '@/lib/push';
import { requireAuth } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const status = await pushConfigurationStatus();
    const deviceCount = status.configured
      ? await prisma.pushSubscription.count({ where: { userId: user.id } })
      : 0;

    return NextResponse.json(
      PushConfig.parse({
        configured: status.configured,
        keysValid: status.keysValid,
        publicKey: status.configured ? (process.env.VAPID_PUBLIC_KEY ?? null) : null,
        subscribed: deviceCount > 0,
        deviceCount,
        emailConfigured: isMerchantEmailConfigured(),
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
