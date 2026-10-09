// Platform product intelligence: every item's buy rate (units per calendar
// day from first to last sale), revenue, margin and stock state, ranked
// fastest-first. Built from the live order-line snapshots across all shops.
// Admin-only cross-shop read.
import 'server-only';

import { NextResponse } from 'next/server';
import { AdminProducts } from '@/lib/contracts/admin';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';

export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

function roundPercent(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);

    const [lines, stock] = await Promise.all([
      prisma.orderLineItem.findMany({
        where: { order: { status: { not: 'CANCELLED' } } },
        select: {
          name: true,
          quantity: true,
          unitPricePesewas: true,
          unitCostPesewas: true,
          orderId: true,
          createdAt: true,
          storeItem: {
            select: {
              id: true,
              stock: true,
              active: true,
              store: { select: { name: true, slug: true, userId: true } },
            },
          },
          order: { select: { userId: true } },
        },
        take: 5000,
      }),
      prisma.storeItem.aggregate({
        _count: true,
        where: { stock: { lte: 0 } },
      }),
    ]);

    type Bucket = {
      name: string;
      shop: string | null;
      slug: string | null;
      units: number;
      orders: Set<string>;
      revenue: number;
      cogs: number;
      first: number;
      last: number;
      stock: number | null;
      active: boolean | null;
    };
    const buckets = new Map<string, Bucket>();
    for (const line of lines) {
      const ownerId = line.order.userId;
      const key = line.storeItem ? `item:${line.storeItem.id}` : `loose:${ownerId}:${line.name}`;
      const at = line.createdAt.getTime();
      const bucket = buckets.get(key) ?? {
        name: line.storeItem ? line.name : line.name,
        shop: line.storeItem?.store.name ?? null,
        slug: line.storeItem?.store.slug ?? null,
        units: 0,
        orders: new Set<string>(),
        revenue: 0,
        cogs: 0,
        first: at,
        last: at,
        stock: line.storeItem?.stock ?? null,
        active: line.storeItem?.active ?? null,
      };
      bucket.units += line.quantity;
      bucket.orders.add(line.orderId);
      bucket.revenue += line.unitPricePesewas * line.quantity;
      if (line.unitCostPesewas != null) bucket.cogs += line.unitCostPesewas * line.quantity;
      if (at < bucket.first) bucket.first = at;
      if (at > bucket.last) bucket.last = at;
      buckets.set(key, bucket);
    }

    const dayKey = (at: number) => new Date(at).toISOString().slice(0, 10);
    const rows = [...buckets.values()].map((bucket) => {
      const daysActive = Math.max(
        1,
        Math.round(
          (Date.parse(`${dayKey(bucket.last)}T00:00:00Z`) -
            Date.parse(`${dayKey(bucket.first)}T00:00:00Z`)) /
            DAY_MS,
        ) + 1,
      );
      const profit = bucket.revenue - bucket.cogs;
      return {
        name: bucket.name,
        shop: bucket.shop,
        slug: bucket.slug,
        units: bucket.units,
        orderCount: bucket.orders.size,
        revenuePesewas: bucket.revenue,
        profitPesewas: profit,
        marginPercent: roundPercent(profit, bucket.revenue),
        unitsPerDay: bucket.units / daysActive,
        daysActive,
        lastSoldAt: new Date(bucket.last).toISOString(),
        stock: bucket.stock,
        active: bucket.active,
      };
    });
    rows.sort((a, b) => b.unitsPerDay - a.unitsPerDay || b.revenuePesewas - a.revenuePesewas);

    const lowStock = await prisma.storeItem.count({
      where: { stock: { gt: 0, lte: 5 } },
    });

    return NextResponse.json(
      AdminProducts.parse({
        items: rows.slice(0, 50),
        totalUnits: rows.reduce((sum, row) => sum + row.units, 0),
        totalRevenuePesewas: rows.reduce((sum, row) => sum + row.revenuePesewas, 0),
        outOfStock: stock._count,
        lowStock,
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
