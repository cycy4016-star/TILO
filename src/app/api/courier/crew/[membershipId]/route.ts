// Approve or suspend one rider on this shop's crew. A suspended membership
// stops dispatch immediately but keeps the rider's audit history.
import 'server-only';

import { NextResponse } from 'next/server';
import { CrewMemberUpdate } from '@/lib/contracts/courier';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ membershipId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { membershipId } = await context.params;
    const parsed = CrewMemberUpdate.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid crew status' }, { status: 400 });
    }

    const member = await prisma.storeCourier.findFirst({
      where: { id: membershipId, store: { userId: user.id } },
      select: { id: true, storeId: true, courierId: true, status: true },
    });
    if (!member) return NextResponse.json({ error: 'Crew member not found' }, { status: 404 });

    const now = new Date();
    await prisma.$transaction([
      prisma.storeCourier.update({
        where: { id: member.id },
        data: {
          status: parsed.data.status,
          approvedBy: parsed.data.status === 'ACTIVE' ? user.id : undefined,
          approvedAt: parsed.data.status === 'ACTIVE' ? now : undefined,
        },
      }),
      prisma.deliveryEvent.create({
        data: {
          storeId: member.storeId,
          courierId: member.courierId,
          type: parsed.data.status === 'ACTIVE' ? 'APPROVED' : 'SUSPENDED',
          actorType: 'MERCHANT',
          actorId: user.id,
        },
      }),
    ]);

    return NextResponse.json({ ok: true, status: parsed.data.status });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
