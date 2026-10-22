// Public crew invite info. The token is the capability in the merchant's
// shared link; no store/buyer data beyond what the rider needs to recognise the
// shop is returned.
import 'server-only';

import { NextResponse } from 'next/server';
import { CourierInviteInfo, CourierJoinInput, CourierJoinResult } from '@/lib/contracts/courier';
import { createCourierSession } from '@/lib/courier-auth';
import { findInviteByToken, inviteIsUsable, joinCrew } from '@/lib/courier-invite';
import { allow, ipOf } from '@/lib/rate-limit';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const invite = await findInviteByToken(token);
    if (!invite || !inviteIsUsable(invite)) {
      return NextResponse.json({ error: 'This crew link is no longer active' }, { status: 404 });
    }
    return NextResponse.json(
      CourierInviteInfo.parse({
        storeName: invite.store.name,
        storeSlug: invite.store.slug,
        storePhone: invite.store.contactPhone,
        expiresAt: invite.expiresAt.toISOString(),
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    if (!allow(`${ipOf(request)}:courier-join`, 8)) {
      return NextResponse.json({ error: 'Too many attempts — slow down' }, { status: 429 });
    }
    const { token } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = CourierJoinInput.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json(
        {
          errors: { [String(first?.path?.[0] ?? 'form')]: first?.message ?? 'Check your details' },
        },
        { status: 400 },
      );
    }

    const joined = await joinCrew({
      inviteToken: token,
      name: parsed.data.name,
      phone: parsed.data.phone,
      vehicleType: parsed.data.vehicleType,
      plateNumber: parsed.data.plateNumber,
      request,
    });
    await createCourierSession(joined.courierId, request);

    return NextResponse.json(
      CourierJoinResult.parse({
        ok: true,
        storeName: joined.storeName,
        status: joined.status,
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
