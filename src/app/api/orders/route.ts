// Authenticated order list and create API.
import 'server-only';

import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import {
  OrderCreate,
  OrderItem,
  OrderLineItem,
  OrderList,
  OrderListQuery,
} from '@/lib/contracts/order';
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

type OrderWithLines = {
  id: string;
  orderNumber: string;
  customerId: string;
  description: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  amountPesewas: number | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: {
    id: string;
    orderId: string;
    storeItemId: string | null;
    name: string;
    unitPricePesewas: number;
    unitCostPesewas: number | null;
    quantity: number;
  }[];
  customer?: { name: string } | null;
};

function serializeOrderLines(lines: OrderWithLines['lines']) {
  return lines.map((line) =>
    OrderLineItem.parse({
      id: line.id,
      orderId: line.orderId,
      storeItemId: line.storeItemId,
      name: line.name,
      unitPricePesewas: line.unitPricePesewas,
      unitCostPesewas: line.unitCostPesewas,
      quantity: line.quantity,
      lineTotalPesewas: line.unitPricePesewas * line.quantity,
    }),
  );
}

function serializeOrder(order: OrderWithLines) {
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
      include: {
        customer: { select: { name: true } },
        lines: true,
      },
    });
    return NextResponse.json(
      OrderList.parse({
        items: orders.map((order) => ({
          ...serializeOrder(order),
          customerName: order.customer?.name ?? '',
          lines: serializeOrderLines(order.lines),
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

    // Resolve line items to the current catalog values so price + cost get
    // snapshotted at sale time. Unknown item ids are rejected.
    const items = parsed.data.lines?.length
      ? await prisma.storeItem.findMany({
          where: { id: { in: parsed.data.lines.map((l) => l.storeItemId) } },
        })
      : [];
    const itemById = new Map(items.map((i) => [i.id, i]));
    const lineData = (parsed.data.lines ?? []).map((line) => {
      const item = itemById.get(line.storeItemId);
      if (!item) throw new Error('UNKNOWN_ITEM');
      return {
        storeItemId: item.id,
        name: item.name,
        unitPricePesewas: item.pricePesewas,
        unitCostPesewas: item.costPricePesewas,
        quantity: line.quantity,
      };
    });

    // Derived amount: sum of line totals. When an explicit amount is given it
    // wins (e.g. a rounded number quoted to the customer over the phone).
    const lineTotalPesewas = lineData.reduce((sum, l) => sum + l.unitPricePesewas * l.quantity, 0);
    const amountPesewas = parsed.data.amountPesewas ?? (lineData.length ? lineTotalPesewas : null);

    const order = await prisma.order.create({
      data: {
        customerId: parsed.data.customerId,
        description: parsed.data.description,
        status: parsed.data.status,
        amountPesewas,
        orderNumber: `TILO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        lines: lineData.length ? { create: lineData } : undefined,
      },
      include: { lines: true },
    });
    return NextResponse.json(
      {
        ...serializeOrder(order),
        lines: serializeOrderLines(order.lines),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error && error.message === 'UNKNOWN_ITEM') {
      return NextResponse.json(
        { errors: { lines: 'One of those items no longer exists' } },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
