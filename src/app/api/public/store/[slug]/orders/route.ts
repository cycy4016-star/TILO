// Public order placement on the storefront: a visitor fills a basket, drops
// name + phone (and a note), and the order lands straight in the owner's
// orders + customers, with a bell notification. No account needed.
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

    // One query for the whole basket, then a missing-id check — a shopper whose
    // basket references a product that went inactive (or onto a hidden shelf)
    // gets a single clear failure rather than a half-built order.
    const requested = [...new Set(parsed.data.lines.map((line) => line.itemId))];
    const found = await prisma.storeItem.findMany({
      where: {
        id: { in: requested },
        storeId: store.id,
        active: true,
        // Hiding a shelf hides its products everywhere, ordering included.
        OR: [{ categoryId: null }, { category: { active: true } }],
      },
    });
    const byId = new Map(found.map((row) => [row.id, row]));
    if (requested.some((id) => !byId.has(id))) {
      return NextResponse.json(
        { error: 'Some items in your basket are no longer available' },
        { status: 404 },
      );
    }

    const captured = await findOrCreateCustomer({
      // Owner comes from the resolved store, never from the request.
      userId: store.userId,
      name: parsed.data.customerName,
      phone: parsed.data.phone,
    });

    const note = parsed.data.note?.trim();
    const lines = parsed.data.lines.flatMap((line) => {
      const item = byId.get(line.itemId);
      // Every id was checked above, so this always lands — but a row that
      // somehow vanished must fail loudly rather than ship a short order.
      if (!item) {
        throw Response.json(
          { error: 'Some items in your basket are no longer available' },
          { status: 404 },
        );
      }
      return [{ item, quantity: line.quantity }];
    });
    const amountPesewas = lines.reduce(
      (total, line) => total + line.item.pricePesewas * line.quantity,
      0,
    );
    const summary = lines.map((line) => `${line.quantity}x ${line.item.name}`).join(', ');
    const order = await prisma.order.create({
      data: {
        // The order is filed under the storefront's owner, so it shows up in that
        // shop's dashboard and nowhere else.
        userId: store.userId,
        customerId: captured.id,
        orderNumber: buildOrderNumber(),
        description: note ? `${summary} — ${note}` : summary,
        status: 'PENDING',
        // Real money is expected for storefront orders, so the amount is derived
        // from the item prices and every line is snapshotted into history.
        amountPesewas,
        lines: {
          create: lines.map((line) => ({
            storeItemId: line.item.id,
            name: line.item.name,
            unitPricePesewas: line.item.pricePesewas,
            unitCostPesewas: line.item.costPricePesewas,
            quantity: line.quantity,
          })),
        },
      },
    });

    // Hoisted so the single-line wording still reads naturally without an
    // unguarded array index.
    const lead = lines[0];
    await notify({
      userId: store.userId,
      kind: 'ORDER_PLACED',
      title:
        lead && lines.length === 1
          ? `New order — ${lead.item.name}`
          : `New order — ${lines.length} items`,
      message: `${captured.name} (${captured.phone}) ordered ${summary}. #${order.orderNumber}`,
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
