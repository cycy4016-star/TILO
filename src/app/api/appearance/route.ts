// Per-user platform appearance API: each signed-in user's own color theme +
// layout preset for the whole dashboard/app. GET returns it (defaults when
// never set); PUT creates or updates it. This is deliberately separate from the
// Store — the public storefront keeps its own look from Store.theme /
// Store.appearance (see /api/store and /store/[slug]).
import 'server-only';

import { NextResponse } from 'next/server';
import {
  AppearancePreferencePayload,
  AppearancePreferenceUpsert,
} from '@/lib/contracts/appearance';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const pref = await prisma.appearancePreference.findUnique({
      where: { userId: user.id },
    });
    // No preference yet → the DB defaults (gold + vibrant), same as a fresh row.
    return NextResponse.json({
      theme: pref?.theme ?? 'gold',
      appearance: pref?.appearance ?? 'vibrant',
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = AppearancePreferenceUpsert.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
        const message = messages[0];
        if (message) errors[field] = message;
      }
      return NextResponse.json({ errors }, { status: 400 });
    }

    const pref = await prisma.appearancePreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        theme: parsed.data.theme ?? 'gold',
        appearance: parsed.data.appearance ?? 'vibrant',
      },
      update: {
        ...(parsed.data.theme ? { theme: parsed.data.theme } : {}),
        ...(parsed.data.appearance ? { appearance: parsed.data.appearance } : {}),
      },
    });

    return NextResponse.json(
      AppearancePreferencePayload.parse({
        theme: pref.theme,
        appearance: pref.appearance,
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
