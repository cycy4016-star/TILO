import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWeeklyDigest } from '@/lib/merchant-alerts';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const LOW_STOCK_THRESHOLD = 2;

function cronSecret(): string | undefined {
  return process.env.CRON_SECRET;
}

function isAuthorized(request: Request): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function run(request: Request) {
  if (!cronSecret()) {
    return NextResponse.json({ error: 'Weekly digest is not configured' }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = new Date(Date.now() - WEEK_MS);
  const stores = await prisma.store.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      userId: true,
      user: { select: { email: true, name: true } },
    },
  });

  let sent = 0;
  for (const store of stores) {
    if (!store.user.email) continue;
    const [orders, newCustomers, lowStock] = await Promise.all([
      prisma.order.findMany({
        where: {
          userId: store.userId,
          createdAt: { gte: since },
          status: { not: 'CANCELLED' },
        },
        select: { amountPesewas: true },
      }),
      prisma.customer.count({
        where: { userId: store.userId, createdAt: { gte: since } },
      }),
      prisma.storeItem.findMany({
        where: { storeId: store.id, active: true, stock: { lte: LOW_STOCK_THRESHOLD } },
        orderBy: { stock: 'asc' },
        take: 5,
        select: { name: true, stock: true },
      }),
    ]);

    const revenuePesewas = orders.reduce((sum, order) => sum + (order.amountPesewas ?? 0), 0);
    const delivered = await sendWeeklyDigest({
      to: store.user.email,
      ownerName: store.user.name,
      storeName: store.name,
      orderCount: orders.length,
      revenuePesewas,
      newCustomers,
      lowStock,
    });
    if (delivered) sent += 1;
  }

  return NextResponse.json({ ok: true, stores: stores.length, sent });
}

export async function GET(request: Request) {
  try {
    return await run(request);
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}

export async function POST(request: Request) {
  try {
    return await run(request);
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
