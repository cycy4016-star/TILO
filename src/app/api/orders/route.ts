// Authenticated order list and create API.
import 'server-only';

import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { OrderCreate, OrderItem, OrderList, OrderListQuery } from '@/lib/contracts/order';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

function validationResponse(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  const fieldErrors = error.flatten().fieldErrors;
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    const message = messages[0];
    if (message) errors[field] = message;
  }
  return NextResponse.json({ errors }, { status: 400 });
}

function serializeOrder(order: {
  id: string;
  orderNumber: string;
  customerId: string;
  description: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  amountPesewas: number | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer?: { name: string } | null;
}) {
  return OrderItem.parse({
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    description: order.description,
    status: order.status,
    amountPesewas: order.amountPesewas ?? null,
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  });
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const url = new URL(request.url);
    const parsedQuery = OrderListQuery.safeParse({
      customerId: url.searchParams.get('customerId') || undefined,
      status: url.searchParams.get('status') || undefined,
      q: url.searchParams.get('q') || undefined,
    });
    if (!parsedQuery.success) return validationResponse(parsedQuery.error);

    const where: Prisma.OrderWhereInput = {};
    const { customerId, status, q } = parsedQuery.data;
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { customer: { select: { name: true } } },
    });
    return NextResponse.json(
      OrderList.parse({
        items: orders.map((order) => ({
          ...serializeOrder(order),
          customerName: order.customer?.name ?? '',
        })),
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = OrderCreate.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    const customer = await prisma.customer.findUnique({ where: { id: parsed.data.customerId } });
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const order = await prisma.order.create({
      data: {
        customerId: parsed.data.customerId,
        description: parsed.data.description,
        status: parsed.data.status,
        amountPesewas: parsed.data.amountPesewas ?? null,
        orderNumber: `TILO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      },
    });
    return NextResponse.json(serializeOrder(order), { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
