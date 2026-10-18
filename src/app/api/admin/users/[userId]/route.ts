// Account moderation for the ops console. A platform admin can promote a
// teammate to operator (or demote them) and suspend/restore a sign-in.
//
// Writes go through better-auth's own admin plugin (set-role / ban-user /
// unban-user) rather than raw Prisma, so the plugin's rules apply: a ban
// revokes the target's live sessions, and the plugin refuses to let an admin
// lock themselves out. requireAdminUser is the outer gate; the plugin re-checks
// the caller's role from the forwarded session headers as a second wall.
import 'server-only';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { AdminUserRow, AdminUserUpdate } from '@/lib/contracts/admin';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ userId: string }> };

async function loadRow(userId: string) {
  const [user, ledger] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
        banned: true,
        createdAt: true,
      },
    }),
    // Permanent sign-in history (survives session deletion — see auth-events.ts).
    prisma.authEvent.aggregate({
      where: { userId, kind: 'SIGNIN' },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);
  if (!user) return null;
  return AdminUserRow.parse({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phoneNumber,
    role: user.role,
    banned: user.banned ?? false,
    signInCount: ledger._count._all,
    lastSeenAt: ledger._max.createdAt ? ledger._max.createdAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdminUser(request);
    const { userId } = await context.params;

    // Guard the operator against locking themselves out of the console.
    if (userId === admin.id) {
      return NextResponse.json({ error: 'You cannot modify your own account' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    const parsed = AdminUserUpdate.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid update' }, { status: 400 });
    }
    const { role, banned } = parsed.data;

    if (banned !== undefined) {
      if (banned) {
        await auth.api.banUser({ body: { userId }, headers: request.headers });
      } else {
        await auth.api.unbanUser({ body: { userId }, headers: request.headers });
      }
    }
    if (role !== undefined) {
      await auth.api.setRole({ body: { userId, role }, headers: request.headers });
    }

    const row = await loadRow(userId);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(row);
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
