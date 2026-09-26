// trigger the automation sweep on demand from the switchboard.
import 'server-only';

import { NextResponse } from 'next/server';
import { runAutomationSweep } from '@/lib/automation';
import { AutomationSweepResult } from '@/lib/contracts/automation';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    // Tenancy: the on-demand "Run now" only sweeps THIS shop's rules, matching
    // what the owner sees on their switchboard. The platform-wide sweep runs
    // from the cron job (/api/cron/rules), which is not user-triggered.
    const result = await runAutomationSweep(new Date(), user.id);
    return NextResponse.json(AutomationSweepResult.parse(result));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
