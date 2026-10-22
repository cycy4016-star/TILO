// Merchant dispatch settings: auto-send new deliveries to the crew, and the
// first radius ring used by dispatch.
import 'server-only';

import { NextResponse } from 'next/server';
import { DispatchSettingsUpdate } from '@/lib/contracts/courier';
import { getStoreForOwner } from '@/lib/courier-invite';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth(request);
    const store = await getStoreForOwner(user.id);
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    const parsed = DispatchSettingsUpdate.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid dispatch settings' }, { status: 400 });
    }
    const updated = await prisma.store.update({
      where: { id: store.id },
      data: parsed.data,
      select: { autoDispatch: true, dispatchRadiusKm: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
