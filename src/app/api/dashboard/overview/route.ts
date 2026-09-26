// authenticated dashboard money-overview API.
import 'server-only';

import { NextResponse } from 'next/server';
import { DashboardOverview } from '@/lib/contracts/dashboard';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const OUTSTANDING_WHERE = {
  amountPesewas: { not: null },
  paidAt: null,
  status: { not: 'CANCELLED' },
} as const;

const DAY_MS = 86_400_000;

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    // Tenancy: every aggregate is scoped to the caller's own orders, so the
    // money figures a shop sees are only ever its own.
    const outstandingWhere = { ...OUTSTANDING_WHERE, userId: user.id };
    const paidThisMonthWhere = {
      userId: user.id,
      paidAt: { gte: startOfMonthIso() },
      amountPesewas: { not: null },
    };

    const [outstanding, oldest, recovered, topChases] = await Promise.all([
      prisma.order.aggregate({
        where: outstandingWhere,
        _sum: { amountPesewas: true },
        _count: true,
      }),
      prisma.order.findFirst({
        where: outstandingWhere,
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.order.aggregate({
        where: paidThisMonthWhere,
        _sum: { amountPesewas: true },
        _count: true,
      }),
      prisma.order.findMany({
        where: outstandingWhere,
        orderBy: { createdAt: 'asc' },
        take: 5,
        include: { customer: { select: { id: true, name: true, phone: true } } },
      }),
    ]);

    const now = Date.now();
    return NextResponse.json(
      DashboardOverview.parse({
        outstandingPesewas: outstanding._sum.amountPesewas ?? 0,
        outstandingCount: outstanding._count,
        oldestOutstandingDays: oldest
          ? Math.max(0, Math.floor((now - oldest.createdAt.getTime()) / DAY_MS))
          : null,
        recoveredMonthPesewas: recovered._sum.amountPesewas ?? 0,
        recoveredMonthCount: recovered._count,
        topChases: topChases.map((order) => ({
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customer.id,
          customerName: order.customer.name,
          customerPhone: order.customer.phone,
          description: order.description,
          amountPesewas: order.amountPesewas ?? 0,
          ageDays: Math.max(0, Math.floor((now - order.createdAt.getTime()) / DAY_MS)),
          status: order.status,
        })),
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
