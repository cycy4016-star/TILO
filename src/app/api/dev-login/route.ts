// Tilo dev-only auth bypass.
//
// WHY THIS EXISTS: the app verifies identity by SMS OTP (the phoneNumber
// plugin in src/lib/auth.ts), and locally SMS_PROVIDER=none means no code can
// ever be delivered — so sign-up and sign-in are both dead ends on a dev box.
// This route lets you start `next dev` and land straight in the dashboard
// instead of staring at a login form you cannot pass.
//
// IT IS INERT UNLESS ALL THREE HOLD:
//   1. NODE_ENV === 'development'  — `next build`/start never satisfies this,
//   2. DEV_BYPASS_AUTH=1           — must be opted into in .env.local, and
//   3. the request came to localhost.
// Otherwise it returns 404, exactly as if the route did not exist.
//
// It signs in through better-auth's own /sign-in/email endpoint (sign-IN stays
// enabled even though sign-UP is disabled in auth-config.ts), so the session
// cookie is issued by better-auth itself. Nothing about production auth is
// touched: requireAuth() and useSession() keep doing their normal job.

import 'server-only';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const DEV_EMAIL = 'dev@tilo.local';
const DEV_PASSWORD = 'tilo-dev-password';

/** Fails closed: any unexpected env (including production) means "no route". */
function bypassEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === '1';
}

/** Idempotently ensure the local dev account + its credential login exist. */
async function ensureDevUser(): Promise<void> {
  const now = new Date();
  // better-auth's default password hasher (src/lib/auth.ts sets no override),
  // so the hash below is verifiable by its own /sign-in/email path.
  const password = await hashPassword(DEV_PASSWORD);

  await prisma.user.upsert({
    where: { id: 'dev_tilo_owner' },
    create: {
      id: 'dev_tilo_owner',
      name: 'Local Dev',
      email: DEV_EMAIL,
      emailVerified: true,
      role: 'admin',
      phoneNumberVerified: true,
      createdAt: now,
      updatedAt: now,
    },
    update: { updatedAt: now },
  });

  const account = await prisma.account.findFirst({
    where: { userId: 'dev_tilo_owner', providerId: 'credential' },
    select: { id: true },
  });

  if (account) {
    // Re-hash every run so a rotated DEV_PASSWORD still matches.
    await prisma.account.update({
      where: { id: account.id },
      data: { password, updatedAt: now },
    });
    return;
  }

  await prisma.account.create({
    data: {
      id: randomUUID(),
      accountId: 'dev_tilo_owner',
      providerId: 'credential',
      userId: 'dev_tilo_owner',
      password,
      createdAt: now,
      updatedAt: now,
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  if (!bypassEnabled()) {
    return new Response('Not found', { status: 404 });
  }

  const url = new URL(request.url);
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    // Localhost only — never let a LAN peer mint a session.
    return new Response('Not found', { status: 404 });
  }

  await ensureDevUser();

  // Let better-auth mint the session (and its cookie) exactly as the sign-in
  // form would, so downstream getSession/requireAuth need no special cases.
  const signIn = await auth.handler(
    new Request(`${url.origin}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: url.origin,
      },
      body: JSON.stringify({ email: DEV_EMAIL, password: DEV_PASSWORD }),
    }),
  );

  if (!signIn.ok) {
    const detail = await signIn.text().catch(() => '');
    return new Response(`dev-login failed (${signIn.status}): ${detail}`, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // Straight to the showcase setup — creating your store is step one.
  const destination = new URL('/dashboard/store', url.origin);
  const response = NextResponse.redirect(destination, 307);
  for (const cookie of signIn.headers.getSetCookie()) {
    response.headers.append('set-cookie', cookie);
  }
  return response;
}
