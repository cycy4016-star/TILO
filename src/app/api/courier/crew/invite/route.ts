// Rotate the crew link. The previous URL stops accepting applications
// immediately; already-approved riders keep their sessions.
import 'server-only';

import { NextResponse } from 'next/server';
import { CrewInviteResult } from '@/lib/contracts/courier';
import { appOrigin, createCrewInvite, getStoreForOwner } from '@/lib/courier-invite';
import { requireAuth } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const store = await getStoreForOwner(user.id);
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    const created = await createCrewInvite(store.id, user.id);
    return NextResponse.json(
      CrewInviteResult.parse({
        url: `${appOrigin(request)}/courier/join/${created.token}`,
        expiresAt: created.expiresAt.toISOString(),
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
