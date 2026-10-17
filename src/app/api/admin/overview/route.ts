// Platform ops overview: cross-shop totals, status mix, SMS + payment health,
// catalogue growth, the inquiry rate and the error-ledger health — plus a
// trailing-14-day series for each of them. Admin-only: this is the one surface
// that deliberately reads across every shop.
import 'server-only';

import { NextResponse } from 'next/server';
import { AdminOverview } from '@/lib/contracts/admin';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;
const SERIES_DAYS = 14;
// The series window is operator-selectable; anything else falls back to 14.
const ALLOWED_SERIES_DAYS = new Set([7, 14, 30]);

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
    const requestedDays = Number(new URL(request.url).searchParams.get('days'));
    const seriesDays = ALLOWED_SERIES_DAYS.has(requestedDays) ? requestedDays : SERIES_DAYS;
    const seriesStart = new Date(startOfDay(now).getTime() - (seriesDays - 1) * DAY_MS);

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
      itemsAddedMonth,
      leads,
      leadsMonth,
      inquiryTotal,
      errorsOpen,
      errorOccurrences,
      feedbackTotal,
      feedbackNew,
      recentItems,
      recentLeads,
      recentIncidents,
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
      prisma.storeItem.count({ where: { createdAt: { gte: monthStart } } }),
      // "Leads" are people, "inquiries" are submissions — a returning visitor
      // who fills the card twice is one lead and two inquiries.
      prisma.customer.count({ where: { source: 'LEAD' } }),
      prisma.customer.count({ where: { source: 'LEAD', createdAt: { gte: monthStart } } }),
      prisma.customer.aggregate({ _sum: { inquiryCount: true } }),
      prisma.appLog.count({ where: { resolvedAt: null } }),
      prisma.appLog.aggregate({ _sum: { count: true } }),
      prisma.feedback.count(),
      prisma.feedback.count({ where: { status: 'NEW' } }),
      prisma.storeItem.findMany({
        where: { createdAt: { gte: seriesStart } },
        select: { createdAt: true },
      }),
      prisma.customer.findMany({
        where: { source: 'LEAD', createdAt: { gte: seriesStart } },
        select: { createdAt: true },
      }),
      // Incidents are folded, so the series plots first sightings: new bugs per
      // day. Repeat occurrences are what errorOccurrences counts.
      prisma.appLog.findMany({
        where: { firstSeenAt: { gte: seriesStart } },
        select: { firstSeenAt: true },
      }),
    ]);

    const daily = Array.from({ length: seriesDays }, (_, index) => {
      const day = new Date(seriesStart.getTime() + index * DAY_MS);
      const key = day.toISOString().slice(0, 10);
      return { day: key, signups: 0, orders: 0, items: 0, inquiries: 0, errors: 0 };
    });
    const byDay = new Map(daily.map((entry) => [entry.day, entry]));
    const bucketFor = (at: Date) => byDay.get(at.toISOString().slice(0, 10));
    for (const user of recentUsers) {
      const bucket = bucketFor(user.createdAt);
      if (bucket) bucket.signups += 1;
    }
    for (const order of recentOrders) {
      const bucket = bucketFor(order.createdAt);
      if (bucket) bucket.orders += 1;
    }
    for (const item of recentItems) {
      const bucket = bucketFor(item.createdAt);
      if (bucket) bucket.items += 1;
    }
    for (const lead of recentLeads) {
      const bucket = bucketFor(lead.createdAt);
      if (bucket) bucket.inquiries += 1;
    }
    for (const incident of recentIncidents) {
      const bucket = bucketFor(incident.firstSeenAt);
      if (bucket) bucket.errors += 1;
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
        itemsAddedMonth,
        leads,
        leadsMonth,
        inquiries: inquiryTotal._sum.inquiryCount ?? 0,
        errorsOpen,
        errorOccurrences: errorOccurrences._sum.count ?? 0,
        feedbackTotal,
        feedbackNew,
        daily,
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
