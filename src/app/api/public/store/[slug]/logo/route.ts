// public store logo — no auth. Serves the bytea stored on Store so the
// storefront can render <img src> before the visitor signs up. 404 when the
// store has no logo.
import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const store = await prisma.store.findUnique({
      where: { slug },
      select: { logo: true, logoMime: true, active: true },
    });
    if (!store || !store.logo || !store.active) {
      return NextResponse.json({ error: 'Logo not found' }, { status: 404 });
    }
    return new Response(store.logo, {
      headers: {
        'content-type': store.logoMime ?? 'image/jpeg',
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
