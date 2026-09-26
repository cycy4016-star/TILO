// Authenticated owner Intelligence API: the balance sheet of the business.
// Reads the live catalog (cost vs sell) and the realized order lines.
import 'server-only';

import { NextResponse } from 'next/server';
import { DashboardIntelligence } from '@/lib/contracts/intelligence';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const OUTSTANDING_WHERE = {
  amountPesewas: { not: null },
  paidAt: null,
  status: { not: 'CANCELLED' },
} as const;

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function roundPercent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    const monthStart = startOfMonth();
    // Tenancy: the balance sheet is built from the caller's own store and
    // orders only. The catalog is reached through their Store row so a shop can
    // never be measured against a rival's stock.
    const store = await prisma.store.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    const [outstanding, moneyIn, catalog, lines] = await Promise.all([
      prisma.order.aggregate({
        where: { ...OUTSTANDING_WHERE, userId: user.id },
        _sum: { amountPesewas: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { userId: user.id, paidAt: { gte: monthStart }, amountPesewas: { not: null } },
        _sum: { amountPesewas: true },
        _count: true,
      }),
      prisma.storeItem.findMany({
        where: { storeId: store?.id ?? '', active: true },
        select: { id: true, name: true, pricePesewas: true, costPricePesewas: true },
      }),
      prisma.orderLineItem.findMany({
        where: { order: { userId: user.id, status: { not: 'CANCELLED' } } },
        select: {
          name: true,
          quantity: true,
          unitPricePesewas: true,
          unitCostPesewas: true,
          orderId: true,
        },
      }),
    ]);

    // Catalog economics: cost vs retail across the live shelf.
    let catalogCostPesewas = 0;
    let catalogSellPesewas = 0;
    let itemsMissingCost = 0;
    for (const item of catalog) {
      catalogSellPesewas += item.pricePesewas;
      if (item.costPricePesewas == null) {
        itemsMissingCost += 1;
        continue;
      }
      catalogCostPesewas += item.costPricePesewas;
    }
    const catalogProfitPesewas = Math.max(0, catalogSellPesewas - catalogCostPesewas);

    // Realized margins from the order-line snapshots.
    const byName = new Map<string, { units: number; revenue: number; cogs: number }>();
    const orderIds = new Set<string>();
    let realizedRevenuePesewas = 0;
    let realizedCogsPesewas = 0;
    let realizedUnitCount = 0;
    for (const line of lines) {
      const revenue = line.unitPricePesewas * line.quantity;
      const cogs = line.unitCostPesewas != null ? line.unitCostPesewas * line.quantity : 0;
      realizedRevenuePesewas += revenue;
      realizedCogsPesewas += cogs;
      realizedUnitCount += line.quantity;
      orderIds.add(line.orderId);
      const bucket = byName.get(line.name) ?? { units: 0, revenue: 0, cogs: 0 };
      bucket.units += line.quantity;
      bucket.revenue += revenue;
      bucket.cogs += cogs;
      byName.set(line.name, bucket);
    }
    const realizedProfitPesewas = realizedRevenuePesewas - realizedCogsPesewas;

    const topItems = [...byName.entries()]
      .map(([name, row]) => ({
        name,
        unitCount: row.units,
        revenuePesewas: row.revenue,
        cogsPesewas: row.cogs,
        profitPesewas: row.revenue - row.cogs,
        marginPercent: roundPercent(row.revenue - row.cogs, row.revenue),
      }))
      .sort((a, b) => b.profitPesewas - a.profitPesewas)
      .slice(0, 5);

    return NextResponse.json(
      DashboardIntelligence.parse({
        moneyInMonthPesewas: moneyIn._sum.amountPesewas ?? 0,
        moneyInMonthCount: moneyIn._count,
        outstandingPesewas: outstanding._sum.amountPesewas ?? 0,
        outstandingCount: outstanding._count,
        catalogItemCount: catalog.length,
        catalogCostPesewas,
        catalogSellPesewas,
        catalogProfitPesewas,
        catalogMarginPercent: roundPercent(catalogProfitPesewas, catalogSellPesewas),
        itemsMissingCost,
        realizedRevenuePesewas,
        realizedCogsPesewas,
        realizedProfitPesewas,
        realizedMarginPercent:
          realizedRevenuePesewas > 0
            ? roundPercent(realizedProfitPesewas, realizedRevenuePesewas)
            : null,
        realizedOrderCount: orderIds.size,
        realizedUnitCount,
        topItems,
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
