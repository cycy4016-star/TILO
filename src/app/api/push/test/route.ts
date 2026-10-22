import 'server-only';

import { NextResponse } from 'next/server';
import { PushTestResult } from '@/lib/contracts/push';
import { sendPushToUser } from '@/lib/push';
import { requireAuth } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const result = await sendPushToUser(user.id, {
      title: 'Tilza notifications are on',
      body: 'New orders and your weekly shop summary will appear here.',
      url: '/dashboard',
      tag: 'tilza-test',
    });
    return NextResponse.json(PushTestResult.parse(result));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
