// One-press recovery: bring back every row a snapshot holds that the live
// database no longer has. Adds only — existing rows are never changed or
// deleted (see src/lib/vault-restore). Admin-only.
import 'server-only';

import { NextResponse } from 'next/server';
import { AdminVaultRestore } from '@/lib/contracts/admin';
import { requireAdminUser } from '@/lib/require-admin-api';
import { routeErrorResponse } from '@/lib/telemetry';
import { restoreMissingFromSnapshot } from '@/lib/vault-restore';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    await requireAdminUser(request);
    const { id } = await params;
    return NextResponse.json(AdminVaultRestore.parse(await restoreMissingFromSnapshot(id)));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
