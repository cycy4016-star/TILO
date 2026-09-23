// trigger the automation sweep on demand from the switchboard.
import 'server-only';

import { NextResponse } from 'next/server';
import { runAutomationSweep } from '@/lib/automation';
import { AutomationSweepResult } from '@/lib/contracts/automation';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    const result = await runAutomationSweep();
    return NextResponse.json(AutomationSweepResult.parse(result));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
