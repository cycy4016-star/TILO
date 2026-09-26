// Scan for rules that have fired + run the automation sweep. Called by an
// external scheduler via cron-job.org / GitHub Actions. Auth: `Authorization:
// Bearer <CRON_SECRET>`. Only meaningful against a live DB + SMS provider.
import 'server-only';

import { runAutomationSweep } from '@/lib/automation';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

async function authorize(request: Request): Promise<boolean> {
  if (!env.CRON_SECRET) return false;
  const value = request.headers.get('authorization') ?? '';
  return value === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Deliberately cross-shop: this is the operator's platform feed, guarded by
  // CRON_SECRET (not a user session). POST below likewise sweeps every shop's
  // rules — the per-shop sweep is the owner-triggered /api/automation/sweep.
  const events = await import('@/lib/db').then(({ prisma }) =>
    prisma.automationEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        kind: true,
        ok: true,
        to: true,
        message: true,
        detail: true,
        createdAt: true,
      },
    }),
  );
  return Response.json({
    items: events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
  });
}

export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runAutomationSweep();
  return Response.json(result);
}
