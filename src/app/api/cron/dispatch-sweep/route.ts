// External trigger for dispatch aging. The app also runs the sweep on a small
// in-process timer, but this endpoint lets an uptime cron keep it moving on a
// deployment that sleeps or runs many short-lived instances.
import 'server-only';

import { NextResponse } from 'next/server';
import { sweepDispatches } from '@/lib/dispatch-sweep';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function run(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Dispatch sweep is not configured' }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await sweepDispatches()) });
}

export async function GET(request: Request) {
  try {
    return await run(request);
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}

export async function POST(request: Request) {
  try {
    return await run(request);
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
