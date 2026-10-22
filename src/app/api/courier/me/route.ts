// Current courier session payload. The invite-scoped cookie is the only
// credential; there is no Better Auth user behind this screen.
import 'server-only';

import { NextResponse } from 'next/server';
import { CourierMe } from '@/lib/contracts/courier';
import { requireCourier } from '@/lib/courier-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { courier } = await requireCourier(request);
    return NextResponse.json(
      CourierMe.parse({
        id: courier.id,
        name: courier.name,
        phone: courier.phone,
        vehicleType: courier.vehicleType,
        plateNumber: courier.plateNumber,
        isOnline: courier.location?.isOnline ?? false,
        lastLocationAt: courier.location?.updatedAt.toISOString() ?? null,
        memberships: courier.memberships.map((membership) => ({
          storeId: membership.storeId,
          storeName: membership.store.name,
          storeSlug: membership.store.slug,
          status: membership.status,
        })),
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
