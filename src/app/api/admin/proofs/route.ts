// Admin proof gallery: buyer-uploaded delivery photos that came with marketing
// consent. Consent gets a photo into this queue; an operator must approve it
// before it can be used anywhere public.
import 'server-only';

import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import {
  AdminProofList,
  AdminProofQuery,
  AdminProofRow,
  AdminProofUpdate,
} from '@/lib/contracts/admin';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

const SELECT = {
  id: true,
  orderId: true,
  createdAt: true,
  size: true,
  mime: true,
  reviewStatus: true,
  reviewedAt: true,
  reviewNote: true,
  order: {
    select: {
      orderNumber: true,
      customer: { select: { name: true } },
      user: { select: { store: { select: { name: true } } } },
    },
  },
} as const;

type ProofSelect = Prisma.DeliveryProofGetPayload<{ select: typeof SELECT }>;

function serialize(row: ProofSelect): AdminProofRow {
  return AdminProofRow.parse({
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.order.orderNumber,
    shop: row.order.user.store?.name ?? null,
    buyer: row.order.customer.name,
    createdAt: row.createdAt.toISOString(),
    size: row.size,
    mime: row.mime,
    reviewStatus: row.reviewStatus,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
    imageUrl: `/api/admin/proofs/${row.id}/image`,
  });
}

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const url = new URL(request.url);
    const parsed = AdminProofQuery.safeParse({
      status: url.searchParams.get('status') || undefined,
    });
    if (!parsed.success) return NextResponse.json({ error: 'Bad filter' }, { status: 400 });

    const where: Prisma.DeliveryProofWhereInput = {
      marketingConsent: true,
      ...(parsed.data.status ? { reviewStatus: parsed.data.status } : {}),
    };

    const [rows, total, pending, approved, rejected] = await Promise.all([
      prisma.deliveryProof.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: LIMIT,
        select: SELECT,
      }),
      prisma.deliveryProof.count({ where }),
      prisma.deliveryProof.count({ where: { marketingConsent: true, reviewStatus: 'PENDING' } }),
      prisma.deliveryProof.count({ where: { marketingConsent: true, reviewStatus: 'APPROVED' } }),
      prisma.deliveryProof.count({ where: { marketingConsent: true, reviewStatus: 'REJECTED' } }),
    ]);

    return NextResponse.json(
      AdminProofList.parse({
        items: rows.map(serialize),
        total,
        pending,
        approved,
        rejected,
      }),
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}

/** Approve or reject one consented proof. The buyer's consent is never changed. */
export async function PUT(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    const parsed = AdminProofUpdate.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'id and status (APPROVED or REJECTED) are required' },
        { status: 400 },
      );
    }

    const existing = await prisma.deliveryProof.findFirst({
      where: { id: parsed.data.id, marketingConsent: true },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Proof not found' }, { status: 404 });

    const row = await prisma.deliveryProof.update({
      where: { id: existing.id },
      data: {
        reviewStatus: parsed.data.status,
        reviewedAt: new Date(),
        reviewedBy: admin.id,
        reviewNote: parsed.data.note ?? null,
      },
      select: SELECT,
    });
    return NextResponse.json(serialize(row));
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
