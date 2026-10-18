// Download one archived world as a JSON file. This is the escape hatch: even
// if the platform itself is gone tomorrow, the operator holds the data.
// Admin-only; payloads can be megabyte-sized, so nothing here is cached.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireAdminUser(request);
    const { id } = await params;
    const snapshot = await prisma.worldSnapshot.findUnique({
      where: { id },
      select: { id: true, createdAt: true, trigger: true, payload: true },
    });
    if (!snapshot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const stamp = snapshot.createdAt.toISOString().replace(/[:.]/g, '-');
    return NextResponse.json(snapshot.payload, {
      headers: {
        'Content-Disposition': `attachment; filename="tilza-vault-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
