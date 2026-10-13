// Feedback triage: everything users said in words, newest first, with the
// NEW → SEEN → RESOLVED workflow the operator works through. Admin-only.
//
// GET lists reports (free text + status + kind filters), PUT moves one report
// along the workflow. Distinct from the error ledger next door: that one is
// what crashed, this one is what a human bothered to type.
import 'server-only';

import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import {
  AdminFeedbackList,
  AdminFeedbackQuery,
  AdminFeedbackRow,
  AdminFeedbackStatus,
} from '@/lib/contracts/admin';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

const LIMIT = 50;

function serialize(row: {
  id: string;
  kind: string;
  status: string;
  rating: number | null;
  message: string;
  page: string | null;
  email: string | null;
  createdAt: Date;
  store: { name: string } | null;
  user: { name: string } | null;
  customer: { name: string } | null;
}): AdminFeedbackRow {
  return AdminFeedbackRow.parse({
    id: row.id,
    kind: row.kind,
    status: row.status,
    rating: row.rating,
    message: row.message,
    page: row.page,
    email: row.email,
    shop: row.store?.name ?? null,
    reporter: row.customer?.name ?? row.user?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  });
}

const SELECT = {
  id: true,
  kind: true,
  status: true,
  rating: true,
  message: true,
  page: true,
  email: true,
  createdAt: true,
  store: { select: { name: true } },
  user: { select: { name: true } },
  customer: { select: { name: true } },
} as const;

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const url = new URL(request.url);
    const parsed = AdminFeedbackQuery.safeParse({
      q: url.searchParams.get('q') || undefined,
      status: url.searchParams.get('status') || undefined,
      kind: url.searchParams.get('kind') || undefined,
    });
    if (!parsed.success) return NextResponse.json({ error: 'Bad filter' }, { status: 400 });
    const { q, status, kind } = parsed.data;

    const where: Prisma.FeedbackWhereInput = {
      ...(status ? { status } : {}),
      ...(kind ? { kind } : {}),
      ...(q
        ? {
            OR: [
              { message: { contains: q, mode: 'insensitive' as const } },
              { email: { contains: q, mode: 'insensitive' as const } },
              { page: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total, newCount] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: LIMIT,
        select: SELECT,
      }),
      prisma.feedback.count({ where }),
      prisma.feedback.count({ where: { status: 'NEW' } }),
    ]);

    return NextResponse.json(
      AdminFeedbackList.parse({
        items: rows.map(serialize),
        total,
        newCount,
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}

/** Move one report along NEW → SEEN → RESOLVED. */
export async function PUT(request: Request) {
  try {
    await requireAdminUser(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    const raw = (body ?? {}) as Record<string, unknown>;
    const id = typeof raw.id === 'string' ? raw.id : '';
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const status = AdminFeedbackStatus.safeParse(raw.status);
    if (!status.success) {
      return NextResponse.json({ error: 'status must be NEW, SEEN or RESOLVED' }, { status: 400 });
    }

    const row = await prisma.feedback.update({
      where: { id },
      data: { status: status.data },
      select: SELECT,
    });
    return NextResponse.json(serialize(row));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
