// Platform ops overview: cross-shop totals, status mix, SMS + payment health
// and a trailing-14-day signup/order series. Admin-only: this is the one
// surface that deliberately reads across every shop.
import 'server-only';

import { NextResponse } from 'next/server';
import { AdminOverview } from '@/lib/contracts/admin';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';

export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;
const SERIES_DAYS = 14;

function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const now = new Date();
    const todayStart = startOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const seriesStart = new Date(startOfDay(now).getTime() - (SERIES_DAYS - 1) * DAY_MS);

    const [
      userCount,
      storeCount,
      activeStores,
      itemCount,
      customerCount,
      orderCount,
      ordersToday,
      signupsMonth,
      gmv,
      paid,
      unpaidOrders,
      smsSent,
      smsFailed,
      smsCredits,
      payPending,
      paySuccess,
      payFailed,
      statusMix,
      recentUsers,
      recentOrders,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.store.count(),
      prisma.store.count({ where: { active: true } }),
      prisma.storeItem.count(),
      prisma.customer.count(),
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.order.aggregate({
        _sum: { amountPesewas: true },
        where: { status: { not: 'CANCELLED' }, amountPesewas: { not: null } },
      }),
      prisma.order.aggregate({
        _sum: { amountPesewas: true },
        where: { paidAt: { not: null }, amountPesewas: { not: null } },
      }),
      prisma.order.count({ where: { paidAt: null, status: { not: 'CANCELLED' } } }),
      prisma.smsUsage.count({ where: { createdAt: { gte: monthStart }, ok: true } }),
      prisma.smsUsage.count({ where: { createdAt: { gte: monthStart }, ok: false } }),
      prisma.smsUsage.aggregate({
        _sum: { credits: true },
        where: { createdAt: { gte: monthStart } },
      }),
      prisma.paymentTransaction.count({ where: { status: 'PENDING' } }),
      prisma.paymentTransaction.count({ where: { status: 'SUCCESS' } }),
      prisma.paymentTransaction.count({ where: { status: { in: ['FAILED', 'ABANDONED'] } } }),
      prisma.order.groupBy({ by: ['status'], _count: true }),
      prisma.user.findMany({
        where: { createdAt: { gte: seriesStart } },
        select: { createdAt: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: seriesStart } },
        select: { createdAt: true },
      }),
    ]);

    const daily = Array.from({ length: SERIES_DAYS }, (_, index) => {
      const day = new Date(seriesStart.getTime() + index * DAY_MS);
      const key = day.toISOString().slice(0, 10);
      return { day: key, signups: 0, orders: 0 };
    });
    const byDay = new Map(daily.map((entry) => [entry.day, entry]));
    for (const user of recentUsers) {
      const bucket = byDay.get(user.createdAt.toISOString().slice(0, 10));
      if (bucket) bucket.signups += 1;
    }
    for (const order of recentOrders) {
      const bucket = byDay.get(order.createdAt.toISOString().slice(0, 10));
      if (bucket) bucket.orders += 1;
    }

    return NextResponse.json(
      AdminOverview.parse({
        users: userCount,
        signupsMonth,
        stores: storeCount,
        activeStores,
        items: itemCount,
        customers: customerCount,
        orders: orderCount,
        ordersToday,
        unpaidOrders,
        gmvPesewas: gmv._sum.amountPesewas ?? 0,
        paidPesewas: paid._sum.amountPesewas ?? 0,
        ordersByStatus: Object.fromEntries(statusMix.map((row) => [row.status, row._count])),
        smsSentMonth: smsSent,
        smsFailedMonth: smsFailed,
        smsCreditsMonth: smsCredits._sum.credits ?? 0,
        paymentsPending: payPending,
        paymentsSuccess: paySuccess,
        paymentsFailed: payFailed,
        daily,
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
