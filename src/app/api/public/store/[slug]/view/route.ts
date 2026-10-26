import 'server-only';

import { NextResponse } from 'next/server';
import { PublicStorefrontView } from '@/lib/contracts/public-store';
import { prisma } from '@/lib/db';
import { allow, ipOf } from '@/lib/rate-limit';
import { getSessionUser } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

const COOKIE_NAME = 'tilza_vid';
const VISITOR_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const BOT_PATTERN =
  /bot|crawler|spider|crawl|preview|headless|facebookexternalhit|slack|discord|telegrambot|whatsapp|googlebot|bingbot|yandex|baidu|semrush|ahrefs/i;

function readVisitorId(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== COOKIE_NAME) continue;
    const value = rest.join('=').trim();
    return VISITOR_PATTERN.test(value) ? value : null;
  }
  return null;
}

function referrerHost(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, '').slice(0, 120) || null;
  } catch {
    return null;
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const userAgent = request.headers.get('user-agent') ?? '';
    const isPrefetch =
      request.headers.get('next-router-prefetch') === '1' ||
      request.headers.get('purpose')?.toLowerCase() === 'prefetch' ||
      request.headers.get('sec-purpose')?.toLowerCase().includes('prefetch');
    if (!userAgent || isPrefetch || BOT_PATTERN.test(userAgent)) {
      return new NextResponse(null, { status: 204 });
    }
    if (!allow(`storefront-view:${ipOf(request)}`, 60)) {
      return new NextResponse(null, { status: 204 });
    }

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const parsed = PublicStorefrontView.safeParse(body);
    if (!parsed.success) {
      return new NextResponse(null, { status: 204 });
    }

    const store = await prisma.store.findFirst({
      where: { slug, active: true },
      select: { id: true, userId: true },
    });
    if (!store) return new NextResponse(null, { status: 204 });

    const viewer = await getSessionUser().catch(() => null);
    if (viewer?.id === store.userId) return new NextResponse(null, { status: 204 });

    const existingVisitor = readVisitorId(request.headers.get('cookie'));
    const visitorId = existingVisitor ?? crypto.randomUUID();
    const response = new NextResponse(null, { status: 204 });
    if (!existingVisitor) {
      response.cookies.set(COOKIE_NAME, visitorId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    await prisma.storefrontView.create({
      data: {
        storeId: store.id,
        visitorId,
        userId: viewer?.id ?? null,
        ref: parsed.data.ref ? parsed.data.ref.toLowerCase() : null,
        referrerHost: referrerHost(parsed.data.referrer),
      },
    });

    return response;
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
