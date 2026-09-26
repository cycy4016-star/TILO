// Marks every notification read — the bell's "Got it" clears the badge.
import 'server-only';

import { NextResponse } from 'next/server';
import { NotificationReadResult } from '@/lib/contracts/notification';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    await prisma.notification.updateMany({
      // Tenancy: "Got it" clears THIS shop's badge only — never another shop's.
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json(NotificationReadResult.parse({ unreadCount: 0 }));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
