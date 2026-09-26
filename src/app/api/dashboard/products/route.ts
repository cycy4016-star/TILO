// Authenticated Products analytics API: per-item sales volume, revenue, cost
// and margins from the order-line snapshots, joined with the live catalog.
import 'server-only';

import { NextResponse } from 'next/server';
import { DashboardProducts } from '@/lib/contracts/products';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

function roundPercent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    const lines = await prisma.orderLineItem.findMany({
      // Tenancy: reached through the caller's own orders, so a shop's margin
      // table can only be built from revenue it actually booked.
      where: { order: { userId: user.id, status: { not: 'CANCELLED' } } },
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
            name: true,
            kind: true,
            active: true,
            pricePesewas: true,
            costPricePesewas: true,
          },
        },
      },
    });

    // Group lines by present store item, else by the snapshot name (deleted
    // items and legacy free-form lines still count under their name).
    const buckets = new Map<
      string,
      {
        name: string;
        id: string | null;
        kind: string | null;
        active: boolean | null;
        currentPrice: number | null;
        currentCost: number | null;
        units: number;
        orders: Set<string>;
        revenue: number;
        cogs: number;
        lastSoldAt: string | null;
      }
    >();

    for (const line of lines) {
      const key = line.storeItem ? `item:${line.storeItem.id}` : `name:${line.name}`;
      const bucket = buckets.get(key) ?? {
        name: line.storeItem?.name ?? line.name,
        id: line.storeItem?.id ?? null,
        kind: line.storeItem?.kind ?? null,
        active: line.storeItem?.active ?? null,
        currentPrice: line.storeItem?.pricePesewas ?? null,
        currentCost: line.storeItem?.costPricePesewas ?? null,
        units: 0,
        orders: new Set<string>(),
        revenue: 0,
        cogs: 0,
        lastSoldAt: null,
      };
      bucket.units += line.quantity;
      bucket.orders.add(line.orderId);
      bucket.revenue += line.unitPricePesewas * line.quantity;
      if (line.unitCostPesewas != null) {
        bucket.cogs += line.unitCostPesewas * line.quantity;
      }
      const soldAt = line.createdAt.toISOString();
      if (bucket.lastSoldAt == null || soldAt > bucket.lastSoldAt) bucket.lastSoldAt = soldAt;
      buckets.set(key, bucket);
    }

    const rows = [...buckets.values()]
      .map((bucket) => {
        const profitPesewas = bucket.revenue - bucket.cogs;
        return {
          name: bucket.name,
          kind: bucket.kind,
          active: bucket.active,
          currentPricePesewas: bucket.currentPrice,
          currentCostPesewas: bucket.currentCost,
          unitCount: bucket.units,
          orderCount: bucket.orders.size,
          revenuePesewas: bucket.revenue,
          cogsPesewas: bucket.cogs,
          profitPesewas,
          marginPercent: bucket.revenue > 0 ? roundPercent(profitPesewas, bucket.revenue) : null,
          lastSoldAt: bucket.lastSoldAt,
        };
      })
      .sort((a, b) => b.revenuePesewas - a.revenuePesewas);

    return NextResponse.json(DashboardProducts.parse({ items: rows }));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
