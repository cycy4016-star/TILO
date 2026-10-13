// Error ledger: the operator's incident console. Every unhandled failure the
// platform captured — server route, server render, or browser report — is a
// grouped row here with a human-readable message, a repeat count and the last
// time it fired. Admin-only.
//
// Two verbs: GET lists incidents (free text + source + open/resolved filters),
// PUT flips an incident between open and resolved so the operator can clear a
// bug they have already dealt with. A recurrence reopens it automatically (see
// src/lib/telemetry.ts), so "resolved" never hides a live failure.
import 'server-only';

import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { AdminLogQuery, AdminLogRow, AdminLogs } from '@/lib/contracts/admin';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

const LIMIT = 50;

function serialize(row: {
  id: string;
  fingerprint: string;
  level: string;
  source: string;
  message: string;
  summary: string | null;
  route: string | null;
  method: string | null;
  status: number | null;
  digest: string | null;
  stack: string | null;
  userId: string | null;
  url: string | null;
  count: number;
  resolvedAt: Date | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}): AdminLogRow {
  return AdminLogRow.parse({
    id: row.id,
    fingerprint: row.fingerprint,
    level: row.level,
    source: row.source,
    message: row.message,
    summary: row.summary,
    route: row.route,
    method: row.method,
    status: row.status,
    digest: row.digest,
    stack: row.stack,
    userId: row.userId,
    url: row.url,
    count: row.count,
    resolved: row.resolvedAt !== null,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
  });
}

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const url = new URL(request.url);
    const parsed = AdminLogQuery.safeParse({
      q: url.searchParams.get('q') || undefined,
      source: url.searchParams.get('source') || undefined,
      status: url.searchParams.get('status') || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Bad filter' }, { status: 400 });
    }
    const { q, source, status } = parsed.data;

    const where: Prisma.AppLogWhereInput = {
      ...(source ? { source } : {}),
      ...(status === 'open'
        ? { resolvedAt: null }
        : status === 'resolved'
          ? { resolvedAt: { not: null } }
          : {}),
      ...(q
        ? {
            OR: [
              { message: { contains: q, mode: 'insensitive' as const } },
              { summary: { contains: q, mode: 'insensitive' as const } },
              { route: { contains: q, mode: 'insensitive' as const } },
              { stack: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total, open] = await Promise.all([
      prisma.appLog.findMany({
        where,
        // Loudest and newest first: a bug firing right now outranks a stale one.
        orderBy: [{ lastSeenAt: 'desc' }],
        take: LIMIT,
      }),
      prisma.appLog.count({ where }),
      prisma.appLog.count({ where: { resolvedAt: null } }),
    ]);

    const items = rows.map(serialize);
    return NextResponse.json(
      AdminLogs.parse({
        items,
        total,
        open,
        occurrences: items.reduce((sum, row) => sum + row.count, 0),
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}

/** Mark one incident resolved (or reopen it). */
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
    if (typeof raw.resolved !== 'boolean') {
      return NextResponse.json({ error: 'resolved must be true or false' }, { status: 400 });
    }

    const row = await prisma.appLog.update({
      where: { id },
      // A reopen clears the stamp; a resolve stamps it now. lastSeenAt is
      // @updatedAt and moves on its own, which is what we want either way.
      data: { resolvedAt: raw.resolved ? new Date() : null },
    });
    return NextResponse.json(serialize(row));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
