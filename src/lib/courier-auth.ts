// Invite-scoped courier authentication. Couriers are deliberately NOT Better
// Auth users: merchant signup hooks count trials/invite limits and the courier
// app should stay independent of the shop workspace. A random cookie token is
// stored only as a SHA-256 hash, so a leaked database row cannot be replayed.
import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

export const COURIER_COOKIE = 'tilza_courier';
const SESSION_DAYS = 90;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function inviteExpiry(days = 30): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

const courierInclude = {
  location: true,
  memberships: {
    include: { store: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
};

export type CourierSessionContext = NonNullable<Awaited<ReturnType<typeof getCourierSession>>>;

export async function createCourierSession(
  courierId: string,
  request?: Request,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.courierSession.create({
    data: {
      tokenHash: hashToken(token),
      courierId,
      expiresAt,
      userAgent: request?.headers.get('user-agent')?.slice(0, 500) ?? null,
      ipAddress: request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    },
  });
  await setCourierCookie(token, expiresAt);
  return { token, expiresAt };
}

export async function setCourierCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(COURIER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearCourierCookie(): Promise<void> {
  const store = await cookies();
  store.set(COURIER_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function getCourierSession() {
  const store = await cookies();
  const token = store.get(COURIER_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.courierSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { courier: { include: courierInclude } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now() || session.courier.status !== 'ACTIVE') {
    await prisma.courierSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  // Presence pings can be frequent; only touch the session row occasionally.
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await prisma.courierSession
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  return { session, courier: session.courier };
}

export async function requireCourier(_request?: Request): Promise<CourierSessionContext> {
  const context = await getCourierSession();
  if (!context) throw Response.json({ error: 'Unauthorized' }, { status: 401 });
  return context;
}
