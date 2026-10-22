// Courier inbox: nearby offers + accepted jobs. Offers never include the
// buyer's name, phone or exact pin until the rider wins the job.
import 'server-only';

import { NextResponse } from 'next/server';
import { requireCourier } from '@/lib/courier-auth';
import { getCourierJobs } from '@/lib/courier-jobs';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { courier } = await requireCourier(request);
    return NextResponse.json(await getCourierJobs(courier.id));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
