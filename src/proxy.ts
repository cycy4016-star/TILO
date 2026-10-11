import { type NextRequest, NextResponse } from 'next/server';
import { buildCsp } from '@/lib/csp';
import { prisma } from '@/lib/db';
import { cspExtraSources } from '../next.user-config';

// /store/[slug] and nothing deeper — the storefront is a single segment.
const STORE_PATH = /^\/store\/([^/]+)\/?$/;

/**
 * True when a live shop owns this slug.
 *
 * Fails open: if the database is unreachable we let the request through and
 * let the storefront page report the failure, rather than have a single
 * probe take down every shop visit. Only the id is read — no bytea columns.
 */
async function shopExists(slug: string): Promise<boolean> {
  try {
    const store = await prisma.store.findFirst({
      where: { slug, active: true },
      select: { id: true },
    });
    return store != null;
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  const csp = buildCsp(nonce, isDev, process.env.NEXT_PUBLIC_API_URL ?? '', cspExtraSources);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  // Hard 404 for unknown shops. /store/[slug] ships a loading.tsx, so the
  // page's own notFound() always fires *after* the 200 shell has streamed and
  // can no longer change the status — search engines saw a soft 404. Checking
  // the slug here runs before any body is sent, so Next serves /_not-found
  // with a real 404 while the storefront keeps its skeleton for live shops.
  const storeSlug = request.nextUrl.pathname.match(STORE_PATH)?.[1];
  if (storeSlug != null && !(await shopExists(decodeURIComponent(storeSlug)))) {
    const notFoundResponse = NextResponse.rewrite(new URL('/_not-found', request.url));
    notFoundResponse.headers.set('Content-Security-Policy', csp);
    return notFoundResponse;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
