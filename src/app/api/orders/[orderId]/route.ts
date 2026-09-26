// authenticated order status API.
import 'server-only';

import { NextResponse } from 'next/server';
import { OrderItem, OrderUpdate } from '@/lib/contracts/order';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { orderId } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = OrderUpdate.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      const key = String(first?.path?.[0] ?? 'form');
      return NextResponse.json(
        { errors: { [key]: first?.message ?? 'Invalid update' } },
        { status: 400 },
      );
    }

    // Tenancy: the order must belong to this shop. This is the read that decides
    // whether the caller may write, so it is scoped — another shop's orderId
    // 404s instead of being mutated.
    const existing = await prisma.order.findFirst({ where: { id: orderId, userId: user.id } });
    if (!existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const data: {
      status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
      amountPesewas?: number | null;
      paidAt?: Date | null;
    } = {};
    if (parsed.data.status !== undefined) data.status = parsed.data.status;
    if (parsed.data.amountPesewas !== undefined) data.amountPesewas = parsed.data.amountPesewas;
    if (parsed.data.paidAt !== undefined)
      data.paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : null;

    const updated = await prisma.order.update({
      // Update by (id, userId) rather than bare id, so the write itself is
      // tenant-guarded even if the row changes between the check and the write.
      where: { id: orderId, userId: user.id },
      data,
    });
    return NextResponse.json(
      OrderItem.parse({
        id: updated.id,
        orderNumber: updated.orderNumber,
        customerId: updated.customerId,
        description: updated.description,
        status: updated.status,
        amountPesewas: updated.amountPesewas ?? null,
        paidAt: updated.paidAt ? updated.paidAt.toISOString() : null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
