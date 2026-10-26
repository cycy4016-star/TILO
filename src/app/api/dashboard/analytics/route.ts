import 'server-only';

import { NextResponse } from 'next/server';
import { StorefrontAnalytics } from '@/lib/contracts/analytics';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;
const DEFAULT_DAYS = 14;
const ALLOWED_DAYS = new Set([7, 14, 30]);

function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const store = await prisma.store.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const requestedDays = Number(new URL(request.url).searchParams.get('days'));
    const days = ALLOWED_DAYS.has(requestedDays) ? requestedDays : DEFAULT_DAYS;
    const start = new Date(startOfDay(new Date()).getTime() - (days - 1) * DAY_MS);

    const [views, storefrontOrders, leads] = await Promise.all([
      prisma.storefrontView.findMany({
        where: { storeId: store.id, createdAt: { gte: start } },
        select: { visitorId: true, ref: true, referrerHost: true, createdAt: true },
      }),
      prisma.order.findMany({
        where: { userId: user.id, channel: 'STOREFRONT', createdAt: { gte: start } },
        select: { createdAt: true, amountPesewas: true, status: true },
      }),
      prisma.customer.count({
        where: { userId: user.id, source: 'LEAD', createdAt: { gte: start } },
      }),
    ]);

    const daily = Array.from({ length: days }, (_, index) => {
      const day = new Date(start.getTime() + index * DAY_MS);
      return {
        day: day.toISOString().slice(0, 10),
        views: 0,
        visitors: new Set<string>(),
        orders: 0,
      };
    });
    const byDay = new Map(daily.map((entry) => [entry.day, entry]));
    const bucketFor = (at: Date) => byDay.get(at.toISOString().slice(0, 10));

    const allVisitors = new Set<string>();
    const sources = new Map<string, number>();
    for (const view of views) {
      const bucket = bucketFor(view.createdAt);
      if (bucket) {
        bucket.views += 1;
        bucket.visitors.add(view.visitorId);
      }
      allVisitors.add(view.visitorId);
      const source = view.ref || view.referrerHost || 'Direct';
      sources.set(source, (sources.get(source) ?? 0) + 1);
    }

    let revenuePesewas = 0;
    for (const order of storefrontOrders) {
      const bucket = bucketFor(order.createdAt);
      if (bucket) bucket.orders += 1;
      if (order.status !== 'CANCELLED') revenuePesewas += order.amountPesewas ?? 0;
    }

    return NextResponse.json(
      StorefrontAnalytics.parse({
        days,
        views: views.length,
        visitors: allVisitors.size,
        storefrontOrders: storefrontOrders.length,
        storefrontRevenuePesewas: revenuePesewas,
        leads,
        conversionRate:
          allVisitors.size > 0
            ? Math.round((storefrontOrders.length / allVisitors.size) * 1000) / 10
            : 0,
        daily: daily.map((entry) => ({
          day: entry.day,
          views: entry.views,
          visitors: entry.visitors.size,
          orders: entry.orders,
        })),
        sources: [...sources.entries()]
          .map(([source, count]) => ({ source, views: count }))
          .sort((a, b) => b.views - a.views || a.source.localeCompare(b.source))
          .slice(0, 5),
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
