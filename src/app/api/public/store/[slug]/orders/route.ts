// Public order placement on the storefront: a visitor picks an item, drops
// name + phone (and a note), and the order lands straight in the owner's
// orders + customers, with a bell notification. No account, no cart.
import 'server-only';

import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { OrderItem, type OrderStatus } from '@/lib/contracts/order';
import { PublicOrderCreate, PublicOrderResult } from '@/lib/contracts/public-store';
import { prisma } from '@/lib/db';
import { notify } from '@/lib/notify';
import { allow, ipOf } from '@/lib/rate-limit';
import { buildOrderNumber, findOrCreateCustomer } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

function serializeOrder(order: {
  id: string;
  orderNumber: string;
  customerId: string;
  description: string;
  status: z.infer<typeof OrderStatus>;
  amountPesewas: number | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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

export async function POST(request: Request, context: RouteContext) {
  try {
    if (!allow(`${ipOf(request)}:order`)) {
      return NextResponse.json(
        { error: 'Too many orders from this address — slow down' },
        { status: 429 },
      );
    }

    const { slug } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = PublicOrderCreate.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const errors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(fieldErrors)) {
        const message = messages[0];
        if (message) errors[field] = message;
      }
      return NextResponse.json({ errors }, { status: 400 });
    }

    const store = await prisma.store.findFirst({ where: { slug, active: true } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const item = await prisma.storeItem.findFirst({
      where: { id: parsed.data.itemId, storeId: store.id, active: true },
    });
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const captured = await findOrCreateCustomer({
      // Owner comes from the resolved store, never from the request.
      userId: store.userId,
      name: parsed.data.customerName,
      phone: parsed.data.phone,
    });

    const note = parsed.data.note?.trim();
    const quantity = parsed.data.quantity;
    const order = await prisma.order.create({
      data: {
        // The order is filed under the storefront's owner, so it shows up in that
        // shop's dashboard and nowhere else.
        userId: store.userId,
        customerId: captured.id,
        orderNumber: buildOrderNumber(),
        description: `${quantity}x ${item.name}${note ? ` — ${note}` : ''}`,
        status: 'PENDING',
        // Real money is expected for storefront orders, so the amount is derived
        // from the item price and the line is snapshotted into history.
        amountPesewas: item.pricePesewas * quantity,
        lines: {
          create: {
            storeItemId: item.id,
            name: item.name,
            unitPricePesewas: item.pricePesewas,
            unitCostPesewas: item.costPricePesewas,
            quantity,
          },
        },
      },
    });

    await notify({
      userId: store.userId,
      kind: 'ORDER_PLACED',
      title: `New order — ${item.name}`,
      message: `${captured.name} (${captured.phone}) ordered ${quantity}x ${item.name}. #${order.orderNumber}`,
      customerId: captured.id,
      orderId: order.id,
    });

    return NextResponse.json(
      PublicOrderResult.parse({
        ok: true,
        order: serializeOrder(order),
        customerId: captured.id,
        createdCustomer: captured.created,
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
