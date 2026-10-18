// Per-kind alert rules for the operator: cadence (OFF/INSTANT/HOURLY/DAILY)
// and, for money kinds, the amount floor below which activity stays silent.
// PUT upserts one kind and answers with the caller's full effective rule set.
// Admin-only.
import 'server-only';

import { NextResponse } from 'next/server';
import { invalidateAdminAlertCache, listAdminAlertSettings } from '@/lib/admin-alerts';
import { AlertsSettingsResult, AlertsSettingsUpdate } from '@/lib/contracts/admin-alerts';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    const body = await request.json().catch(() => null);
    const parsed = AlertsSettingsUpdate.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid alert settings' }, { status: 400 });
    }
    const { kind, cadence, minAmountPesewas } = parsed.data;

    await prisma.adminAlertSetting.upsert({
      where: { userId_kind: { userId: admin.id, kind } },
      create: {
        userId: admin.id,
        kind,
        cadence,
        minAmountPesewas: minAmountPesewas ?? null,
      },
      update: {
        cadence,
        ...(minAmountPesewas === undefined ? {} : { minAmountPesewas }),
      },
    });
    // Captures read settings through a short-lived cache; a rules change must
    // bite immediately or the editor lies about what is live.
    invalidateAdminAlertCache();

    return NextResponse.json(
      AlertsSettingsResult.parse({ settings: await listAdminAlertSettings(admin.id) }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
