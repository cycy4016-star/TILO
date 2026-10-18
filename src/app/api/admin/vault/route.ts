// The vault API: the terminal's window into the self-archive. GET returns the
// snapshot list, the live world's counts, and the loss between them — the
// integrity readout the console shouts about. POST takes a manual snapshot on
// demand (automatic ones ride on instrumentation.ts). Admin-only.
import 'server-only';

import { NextResponse } from 'next/server';
import { AdminVault } from '@/lib/contracts/admin';
import { requireAdminUser } from '@/lib/require-admin-api';
import { routeErrorResponse } from '@/lib/telemetry';
import { createWorldSnapshot, currentWorldCounts, listWorldSnapshots } from '@/lib/vault';
import { diffWorlds } from '@/lib/vault-diff';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const [snapshots, current] = await Promise.all([listWorldSnapshots(), currentWorldCounts()]);
    const latest = snapshots[0];
    return NextResponse.json(
      AdminVault.parse({
        snapshots,
        current,
        loss: latest ? diffWorlds(latest.counts, current) : [],
        since: latest?.createdAt ?? null,
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const snapshot = await createWorldSnapshot('manual');
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
