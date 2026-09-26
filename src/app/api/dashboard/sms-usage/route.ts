// authenticated SMS usage API. Reads the SmsUsage ledger written by
// src/lib/sms.ts so the owner can see credits burned this month and over time.
import 'server-only';

import { NextResponse } from 'next/server';
import { SmsUsageOverview } from '@/lib/contracts/sms';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const monthStart = startOfMonth();
    // Tenancy: the spend readout is this shop's own ledger only, so a shop is
    // never shown (or billed for) another shop's traffic. Sign-up OTPs carry no
    // userId and are therefore outside every shop's total by design.
    const owned = { userId: user.id };
    const monthWhere = { ...owned, ok: true, createdAt: { gte: monthStart } };

    const [month, monthFailed, allTime, bySource, recent] = await Promise.all([
      prisma.smsUsage.aggregate({
        where: monthWhere,
        _sum: { credits: true },
        _count: true,
      }),
      prisma.smsUsage.count({
        where: { ...owned, ok: false, createdAt: { gte: monthStart } },
      }),
      prisma.smsUsage.aggregate({
        where: { ...owned, ok: true },
        _sum: { credits: true },
        _count: true,
      }),
      prisma.smsUsage.groupBy({
        by: ['source'],
        where: monthWhere,
        _sum: { credits: true },
        _count: true,
      }),
      prisma.smsUsage.findMany({
        where: owned,
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const monthCredits = month._sum.credits ?? 0;

    return NextResponse.json(
      SmsUsageOverview.parse({
        monthSent: month._count,
        monthFailed,
        monthCredits,
        monthEstimatedCostPesewas: monthCredits * env.SMS_COST_PER_CREDIT_PESEWAS,
        allTimeSent: allTime._count,
        allTimeCredits: allTime._sum.credits ?? 0,
        bySource: bySource.map((row) => ({
          source: row.source,
          sent: row._count,
          credits: row._sum.credits ?? 0,
        })),
        recent: recent.map((row) => ({
          id: row.id,
          to: row.to,
          source: row.source,
          credits: row.credits,
          ok: row.ok,
          createdAt: row.createdAt.toISOString(),
        })),
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
