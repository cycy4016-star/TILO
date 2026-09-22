// trigger the automation sweep on demand from the admin switchboard.
import 'server-only';

import { NextResponse } from 'next/server';
import { runAutomationSweep } from '@/lib/automation';
import { AutomationSweepResult } from '@/lib/contracts/automation';
import { requireAdminUser } from '@/lib/require-admin-api';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const result = await runAutomationSweep();
    return NextResponse.json(AutomationSweepResult.parse(result));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
