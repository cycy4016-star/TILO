// Admin monitor API: every Tilo account with their sign-in pulse. This is the
// one route that deliberately reads ACROSS shops — it is the platform operator's
// view, guarded by requireAdminUser (403 for a signed-in non-admin).
import 'server-only';

import { NextResponse } from 'next/server';
import { AdminUserMonitor, AdminUserRow } from '@/lib/contracts/admin';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const monthStart = startOfMonth();

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
        banned: true,
        createdAt: true,
        sessions: { select: { id: true, createdAt: true } },
      },
    });

    const rows = users.map((user) => {
      const lastSeen = user.sessions.reduce<Date | null>((latest, session) => {
        if (!latest || session.createdAt > latest) return session.createdAt;
        return latest;
      }, null);
      return AdminUserRow.parse({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phoneNumber,
        role: user.role,
        banned: user.banned ?? false,
        sessionCount: user.sessions.length,
        lastSeenAt: lastSeen ? lastSeen.toISOString() : null,
        createdAt: user.createdAt.toISOString(),
      });
    });

    return NextResponse.json(
      AdminUserMonitor.parse({
        users: rows,
        totalUsers: users.length,
        // Counted with the same helper the gate uses, so the number on screen can
        // never disagree with who is actually able to open this page.
        adminCount: users.filter((user) => isAdminRole(user.role)).length,
        // Users who opened the app since the month began (a session exists).
        activeThisMonth: users.filter((user) =>
          user.sessions.some((session) => session.createdAt >= monthStart),
        ).length,
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
