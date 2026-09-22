// Weekly pulse summary SMS to SMS_SUMMARY_RECIPIENT. Called by an external
// scheduler (cron-job.org / GitHub Actions) once a week. Auth: `Authorization:
// Bearer <CRON_SECRET>`.
import 'server-only';

import { runWeeklySummary } from '@/lib/automation';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

async function authorize(request: Request): Promise<boolean> {
  if (!env.CRON_SECRET) return false;
  const value = request.headers.get('authorization') ?? '';
  return value === `Bearer ${env.CRON_SECRET}`;
}

export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runWeeklySummary();
  return Response.json(result);
}
