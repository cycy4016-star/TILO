// Admin monitor API: every Tilza account with their sign-in pulse. This is the
// one route that deliberately reads ACROSS shops — it is the platform operator's
// view, guarded by requireAdminUser (403 for a signed-in non-admin).
//
// Sign-in counts and "last seen" come from the append-only auth_event ledger,
// NOT from Session rows: better-auth deletes sessions on sign-out, on
// revocation and on expiry, so the old session-derived numbers used to shrink
// to zero whenever a user logged out or returned days later. The ledger rows
// are permanent, keyed to the user's unique id, and each sign-in appends a new
// row (see src/lib/auth-events.ts and prisma/schema/auth.prisma).
import 'server-only';

import { NextResponse } from 'next/server';
import { AdminUserMonitor, AdminUserRow } from '@/lib/contracts/admin';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';
import { isAdminRole } from '@/lib/roles';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const monthStart = startOfMonth();

    const [users, signInsAllTime, signInsThisMonth] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          role: true,
          banned: true,
          createdAt: true,
          audiences: { select: { kind: true } },
          _count: { select: { shopperOrders: true } },
        },
      }),
      // Lifetime sign-in count + last sign-in per user, straight off the ledger.
      prisma.authEvent.groupBy({
        by: ['userId'],
        where: { kind: 'SIGNIN' },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      // Who signed in since the month began — the "active this month" set.
      prisma.authEvent.groupBy({
        by: ['userId'],
        where: { kind: 'SIGNIN', createdAt: { gte: monthStart } },
        _count: { _all: true },
      }),
    ]);

    const lifetime = new Map(signInsAllTime.map((row) => [row.userId, row]));

    const rows = users.map((user) => {
      const stats = lifetime.get(user.id);
      return AdminUserRow.parse({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phoneNumber,
        role: user.role,
        banned: user.banned ?? false,
        audiences: user.audiences.map((audience) => audience.kind),
        claimedOrders: user._count.shopperOrders,
        signInCount: stats?._count._all ?? 0,
        lastSeenAt: stats?._max.createdAt ? stats._max.createdAt.toISOString() : null,
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
        shopperCount: users.filter((user) =>
          user.audiences.some((audience) => audience.kind === 'SHOPPER'),
        ).length,
        // Users who signed in (permanently recorded) since the month began.
        activeThisMonth: signInsThisMonth.length,
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
