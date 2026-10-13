// Ingest for browser-reported crashes. The page posts here (sendBeacon) when a
// render blows up or a promise rejects, and the row lands in the same AppLog
// ledger as server failures — so the operator reads ONE stream, not two.
//
// Untrusted input, best-effort contract: a malformed report is acknowledged and
// dropped rather than rejected, because the reporter is already broken and has
// nowhere sensible to surface a 400.
import 'server-only';

import { NextResponse } from 'next/server';
import { ClientErrorAck, ClientErrorReport } from '@/lib/contracts/telemetry';
import { allow, ipOf } from '@/lib/rate-limit';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Generous ceiling: a broken page can retry, a botnet should not.
    if (!allow(`${ipOf(request)}:client-error`, 30)) {
      return NextResponse.json({ ok: true });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(ClientErrorAck.parse({ ok: true }));
    }

    const parsed = ClientErrorReport.safeParse(body);
    if (!parsed.success) return NextResponse.json(ClientErrorAck.parse({ ok: true }));

    const { recordError, routeOf } = await import('@/lib/telemetry');
    const page = parsed.data.url ?? null;
    await recordError({
      message: parsed.data.message,
      stack: [parsed.data.stack, parsed.data.componentStack].filter(Boolean).join('\n') || null,
      digest: parsed.data.digest ?? null,
      // Group by the page PATH, never the full URL — query strings and ids
      // would split one browser crash into a hundred incidents.
      route: page ? routeOf(new URL(page, 'http://local').pathname) : null,
      method: 'BROWSER',
      source: 'CLIENT',
      url: page,
    });

    return NextResponse.json(ClientErrorAck.parse({ ok: true }));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
