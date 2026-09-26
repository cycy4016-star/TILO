// Public visitor capture on the storefront: a visitor ticks the consent box
// and drops their details; they're added to the owner's customers and the
// bell rings. Every write requires opt-in (consent must be true).
import 'server-only';

import { NextResponse } from 'next/server';
import { PublicLeadCreate, PublicLeadResult } from '@/lib/contracts/public-store';
import { prisma } from '@/lib/db';
import { notify } from '@/lib/notify';
import { allow, ipOf } from '@/lib/rate-limit';
import { findOrCreateCustomer } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

// Hidden field honeypot — real visitors never fill it in, bots usually do.
function isBot(body: Record<string, unknown>): boolean {
  return Boolean(body.website && String(body.website).length > 0);
}

export async function POST(request: Request, context: RouteContext) {
  try {
    if (!allow(`${ipOf(request)}:lead`)) {
      return NextResponse.json(
        { error: 'Too many submissions from this address' },
        { status: 429 },
      );
    }

    const { slug } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const raw = (body ?? {}) as Record<string, unknown>;
    if (isBot(raw)) {
      // Bots get a happy-looking 201 without saving anything.
      return NextResponse.json(
        PublicLeadResult.parse({ ok: true, customerId: '', created: true }),
        {
          status: 201,
        },
      );
    }

    const parsed = PublicLeadCreate.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const errors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(fieldErrors)) {
        const message = messages[0];
        if (message) errors[field] = message;
      }
      return NextResponse.json({ errors }, { status: 400 });
    }

    const store = await prisma.store.findFirst({ where: { slug, active: true } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const captured = await findOrCreateCustomer({
      // Owner comes from the resolved store, never from the request.
      userId: store.userId,
      name: parsed.data.name,
      phone: parsed.data.phone,
      town: parsed.data.town,
    });

    await notify({
      userId: store.userId,
      kind: 'VISITOR_CAPTURED',
      title: `${captured.created ? 'New visitor joined' : 'Returning visitor'} — ${captured.name}`,
      message: [captured.phone, parsed.data.town?.trim(), parsed.data.note?.trim()]
        .filter(Boolean)
        .join(' · '),
      customerId: captured.id,
    });

    return NextResponse.json(
      PublicLeadResult.parse({ ok: true, customerId: captured.id, created: captured.created }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
