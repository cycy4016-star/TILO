// Merchant delivery crew overview: the one shareable invite link, pending
// applications, approved riders, and their current shift state.
import 'server-only';

import { NextResponse } from 'next/server';
import { CrewOverview } from '@/lib/contracts/courier';
import { appOrigin, createCrewInvite, getStoreForOwner } from '@/lib/courier-invite';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

const ONLINE_WINDOW_MS = 30 * 60 * 1000;

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const store = await getStoreForOwner(user.id);
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    let invite = await prisma.courierCrewInvite.findFirst({
      where: {
        storeId: store.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        token: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { token: true, expiresAt: true },
    });
    // Opening the page should always show a usable link, so mint the first one
    // lazily. Rotating later is an explicit merchant action.
    if (!invite?.token) {
      const created = await createCrewInvite(store.id, user.id);
      invite = { token: created.token, expiresAt: created.expiresAt };
    }

    const members = await prisma.storeCourier.findMany({
      where: { storeId: store.id },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        status: true,
        createdAt: true,
        courier: {
          select: {
            id: true,
            name: true,
            phone: true,
            vehicleType: true,
            plateNumber: true,
            location: { select: { isOnline: true, updatedAt: true } },
          },
        },
      },
    });

    const delivered = await prisma.order.groupBy({
      by: ['courierId'],
      where: {
        userId: user.id,
        courierId: { in: members.map((member) => member.courier.id) },
        deliveryStatus: 'DELIVERED',
      },
      _count: { _all: true },
    });
    const deliveredBy = new Map(delivered.map((row) => [row.courierId, row._count._all] as const));

    const onlineCutoff = Date.now() - ONLINE_WINDOW_MS;
    const serialized = members.map((member) => {
      const location = member.courier.location;
      const isOnline = Boolean(location?.isOnline && location.updatedAt.getTime() >= onlineCutoff);
      return {
        membershipId: member.id,
        courierId: member.courier.id,
        name: member.courier.name,
        phone: member.courier.phone,
        vehicleType: member.courier.vehicleType,
        plateNumber: member.courier.plateNumber,
        status: member.status,
        isOnline,
        lastLocationAt: location ? location.updatedAt.toISOString() : null,
        joinedAt: member.createdAt.toISOString(),
        deliveries: deliveredBy.get(member.courier.id) ?? 0,
      };
    });

    return NextResponse.json(
      CrewOverview.parse({
        storeId: store.id,
        storeName: store.name,
        autoDispatch: store.autoDispatch,
        dispatchRadiusKm: store.dispatchRadiusKm,
        inviteUrl: `${appOrigin(request)}/courier/join/${invite.token}`,
        inviteExpiresAt: invite.expiresAt.toISOString(),
        pendingCount: serialized.filter((member) => member.status === 'PENDING').length,
        onlineCount: serialized.filter((member) => member.isOnline).length,
        members: serialized,
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
