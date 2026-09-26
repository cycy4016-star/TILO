// recent automation activity feed for the switchboard island.
import 'server-only';

import { NextResponse } from 'next/server';
import { AutomationEventList } from '@/lib/contracts/automation';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const events = await prisma.automationEvent.findMany({
      // Tenancy: reached through the caller's own rules. Events are the audit
      // log of what the switchboard texted, including customer names and phone
      // numbers in `message`, so another shop's log must never be readable.
      where: { rule: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        kind: true,
        orderId: true,
        to: true,
        message: true,
        ok: true,
        detail: true,
        createdAt: true,
      },
    });
    return NextResponse.json(
      AutomationEventList.parse({
        items: events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
