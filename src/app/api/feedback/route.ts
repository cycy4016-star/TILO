// Public feedback ingest: the other half of "I don't want to read error codes".
// The error ledger records what broke; this records what a human typed about
// it. Open on purpose — a shopper on a storefront has no account and must still
// be able to reach the operator.
//
// Untrusted, best-effort input:
//   - rate limited per IP, and a rejection is answered with the same success
//     shape so a bot learns nothing;
//   - a hidden `website` honeypot is filled by bots — acknowledge and save
//     nothing;
//   - a signed-in caller is attributed (userId), a storefront report is
//     attributed to its shop (storeId via `slug`), everything else is a
//     platform-level report with both null.
import 'server-only';

import { NextResponse } from 'next/server';
import { FeedbackAck, FeedbackCreate } from '@/lib/contracts/feedback';
import { prisma } from '@/lib/db';
import { allow, ipOf } from '@/lib/rate-limit';
import { getSessionUser } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (!allow(`${ipOf(request)}:feedback`, 5)) {
      return NextResponse.json(FeedbackAck.parse({ ok: true }));
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    const raw = (body ?? {}) as Record<string, unknown>;
    if (raw.website && String(raw.website).length > 0) {
      return NextResponse.json(FeedbackAck.parse({ ok: true }), { status: 201 });
    }

    const parsed = FeedbackCreate.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
        const message = messages[0];
        if (message) errors[field] = message;
      }
      return NextResponse.json({ errors }, { status: 400 });
    }
    const { message, kind, rating, email, slug } = parsed.data;

    // Page is context, not identity: prefer what the form saw, else the
    // referer, else nothing. Never a full off-site URL.
    const referer = request.headers.get('referer');
    const page =
      parsed.data.page ??
      (referer
        ? (() => {
            try {
              return new URL(referer).pathname;
            } catch {
              return null;
            }
          })()
        : null);

    let storeId: string | null = null;
    if (slug) {
      // A bad slug is not an error — the report still matters, it just has no
      // shop attached to it.
      const store = await prisma.store.findFirst({ where: { slug }, select: { id: true } });
      storeId = store?.id ?? null;
    }

    const user = await getSessionUser().catch(() => null);

    await prisma.feedback.create({
      data: {
        message,
        kind,
        rating: rating ?? null,
        email: email || null,
        page,
        userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
        userId: user?.id ?? null,
        storeId,
      },
    });

    return NextResponse.json(FeedbackAck.parse({ ok: true }), { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
