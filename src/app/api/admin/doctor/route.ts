// The doctor API: one GET runs the whole self-check suite against the live
// platform and returns every result — plain sentence, verdict and fix steps.
// Nothing is cached; each call re-examines the system. Admin-only.
import 'server-only';

import { NextResponse } from 'next/server';
import { AdminDoctor } from '@/lib/contracts/admin';
import { runDoctor } from '@/lib/doctor';
import { requireAdminUser } from '@/lib/require-admin-api';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    return NextResponse.json(AdminDoctor.parse(await runDoctor()));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
