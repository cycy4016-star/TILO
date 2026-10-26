// Public order placement on the storefront: a visitor fills a basket, drops
// name + phone (and a note), and the order lands straight in the owner's
// orders + customers, with a bell notification. No account needed.
import 'server-only';

import type { Order } from '@prisma/client';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { captureAdminAlert } from '@/lib/admin-alerts';
import {
  type DeliveryStatusValue,
  formatGhs,
  OrderItem,
  type OrderStatus,
} from '@/lib/contracts/order';
import { PublicOrderCreate, PublicOrderResult } from '@/lib/contracts/public-store';
import { prisma } from '@/lib/db';
import { calculateDeliveryFee, hasCoordinates } from '@/lib/delivery';
import { dispatchOrder } from '@/lib/dispatch';
import { sendOrderAlert } from '@/lib/merchant-alerts';
import { notify } from '@/lib/notify';
import { signOrderToken } from '@/lib/order-tracking';
import { couponDiscount, couponErrorMessage } from '@/lib/promotions';
import { sendPushToUser } from '@/lib/push';
import { allow, ipOf } from '@/lib/rate-limit';
import { getSessionUser } from '@/lib/require-auth';
import { buildOrderNumber, type CapturedCustomer, findOrCreateCustomer } from '@/lib/storefront';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

// Thrown inside the interactive transaction so a lost stock race rolls back the
// customer row and the order instead of leaving a half-written sale behind.
class StockConflictError extends Error {
  constructor() {
    super('Stock changed while the order was being placed');
    this.name = 'StockConflictError';
  }
}

function serializeOrder(order: {
  id: string;
  orderNumber: string;
  customerId: string;
  description: string;
  status: z.infer<typeof OrderStatus>;
  amountPesewas: number | null;
  discountPesewas: number;
  promoCode: string | null;
  fulfillmentMethod: 'DIRECT_PICKUP' | 'LOCAL_DELIVERY';
  deliveryStatus: DeliveryStatusValue;
  customerLat: number | null;
  customerLng: number | null;
  deliveryFeePesewas: number;
  riderId: string | null;
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
    discountPesewas: order.discountPesewas,
    promoCode: order.promoCode,
    fulfillmentMethod: order.fulfillmentMethod,
    deliveryStatus: order.deliveryStatus,
    customerLat: order.customerLat,
    customerLng: order.customerLng,
    deliveryFeePesewas: order.deliveryFeePesewas,
    riderId: order.riderId,
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

    // A signed-in shopper's order is linked to their account at checkout. Keep
    // store owners out of their own shopper history so the tracking page and
    // dashboard never describe the same sale twice.
    const viewer = await getSessionUser();
    const shopperId = viewer && viewer.id !== store.userId ? viewer.id : null;

    // Fulfillment pricing is checked before any customer write: a shop without
    // a pin cannot offer delivery, so a rejected checkout leaves no half-made
    // customer record behind. The fee uses the shop's live pin; the preview in
    // the checkout dialog is advisory only.
    const fulfillmentMethod = parsed.data.fulfillmentMethod;
    let customerLat: number | null = null;
    let customerLng: number | null = null;
    let deliveryFeePesewas = 0;
    if (fulfillmentMethod === 'LOCAL_DELIVERY') {
      if (store.lat == null || store.lng == null) {
        return NextResponse.json(
          {
            errors: {
              fulfillmentMethod: 'This shop has not set its pickup location yet — choose pickup.',
            },
          },
          { status: 409 },
        );
      }
      const coords = { lat: parsed.data.customerLat, lng: parsed.data.customerLng };
      if (!hasCoordinates(coords)) {
        return NextResponse.json(
          { errors: { customerLat: 'Allow location access so we can price the delivery.' } },
          { status: 400 },
        );
      }
      customerLat = coords.lat;
      customerLng = coords.lng;
      deliveryFeePesewas = calculateDeliveryFee(store.lat, store.lng, coords.lat, coords.lng);
    }

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
      // Price, cost, stock and name are all the order path reads — the photo
      // bytes stay in Postgres.
      select: {
        id: true,
        name: true,
        categoryId: true,
        pricePesewas: true,
        costPricePesewas: true,
        stock: true,
      },
    });
    const byId = new Map(found.map((row) => [row.id, row]));
    if (requested.some((id) => !byId.has(id))) {
      return NextResponse.json(
        { error: 'Some items in your basket are no longer available' },
        { status: 404 },
      );
    }

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
    // Stocked items sell atomically: refuse the short line before anything is
    // written, then decrement under a guarded update so two shoppers racing
    // for the last unit cannot both take it.
    for (const line of lines) {
      if (line.item.stock != null && line.item.stock < line.quantity) {
        return NextResponse.json(
          {
            error:
              line.item.stock === 0
                ? `${line.item.name} just sold out`
                : `Only ${line.item.stock} of ${line.item.name} left`,
          },
          { status: 409 },
        );
      }
    }
    const subtotalPesewas = lines.reduce(
      (total, line) => total + line.item.pricePesewas * line.quantity,
      0,
    );

    // Coupon redemption. The dialog previews this same pure function against the
    // public promo list, but the price charged here is recomputed from the
    // database — a crafted request can quote any code but not its own discount.
    let discountPesewas = 0;
    let promoCode: string | null = null;
    const submittedCode = parsed.data.code?.trim();
    if (submittedCode) {
      const promotions = await prisma.promotion.findMany({
        where: { storeId: store.id, code: { equals: submittedCode, mode: 'insensitive' } },
        select: {
          name: true,
          code: true,
          kind: true,
          value: true,
          minSubtotalPesewas: true,
          active: true,
          startsAt: true,
          endsAt: true,
          itemIds: true,
          categoryIds: true,
        },
      });
      const coupon = couponDiscount(
        promotions.map((promotion) => ({
          ...promotion,
          startsAt: promotion.startsAt ? promotion.startsAt.toISOString() : null,
          endsAt: promotion.endsAt ? promotion.endsAt.toISOString() : null,
        })),
        submittedCode,
        lines.map((line) => ({
          itemId: line.item.id,
          categoryId: line.item.categoryId,
          pricePesewas: line.item.pricePesewas,
          quantity: line.quantity,
        })),
      );
      if (!coupon.ok) {
        return NextResponse.json({ errors: { code: couponErrorMessage(coupon) } }, { status: 400 });
      }
      discountPesewas = coupon.discountPesewas;
      promoCode = coupon.code;
    }

    const amountPesewas = subtotalPesewas - discountPesewas + deliveryFeePesewas;

    const tracked = lines.filter((line) => line.item.stock != null);
    const summary = lines.map((line) => `${line.quantity}x ${line.item.name}`).join(', ');

    // Customer capture, stock reservation and order creation are one unit. A
    // stock race tripping the guarded update throws, so the customer row and any
    // earlier line decrements roll back rather than leaving a partial sale.
    let captured: CapturedCustomer;
    let order: Order;
    try {
      const placed = await prisma.$transaction(async (tx) => {
        const customer = await findOrCreateCustomer(
          {
            // Owner comes from the resolved store, never from the request.
            userId: store.userId,
            name: parsed.data.customerName,
            phone: parsed.data.phone,
            // Checkout is a purchase, not an enquiry — it never bumps inquiryCount.
            source: 'ORDER',
          },
          tx,
        );

        for (const line of tracked) {
          const decremented = await tx.storeItem.updateMany({
            where: { id: line.item.id, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });
          if (decremented.count === 0) throw new StockConflictError();
        }

        const created = await tx.order.create({
          data: {
            // The order is filed under the storefront's owner, so it shows up in
            // that shop's dashboard and nowhere else.
            userId: store.userId,
            customerId: customer.id,
            shopperId,
            orderNumber: buildOrderNumber(),
            description: note ? `${summary} — ${note}` : summary,
            status: 'PENDING',
            channel: 'STOREFRONT',
            // Real money is expected for storefront orders, so the amount is
            // derived from the item prices and every line is snapshotted into
            // history. amountPesewas is already net of any coupon discount.
            amountPesewas,
            discountPesewas,
            promoCode,
            // Pickup stays NOT_APPLICABLE forever. Local delivery either goes
            // straight to the merchant's approved crew (auto-dispatch) or waits
            // for the merchant to broadcast from the dashboard.
            fulfillmentMethod,
            deliveryStatus:
              fulfillmentMethod === 'LOCAL_DELIVERY' && store.autoDispatch
                ? 'PENDING_DISPATCH'
                : 'NOT_APPLICABLE',
            customerLat,
            customerLng,
            deliveryFeePesewas,
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

        if (shopperId) {
          await tx.userAudience.upsert({
            where: { userId_kind: { userId: shopperId, kind: 'SHOPPER' } },
            create: { userId: shopperId, kind: 'SHOPPER' },
            update: {},
          });
        }

        return { captured: customer, order: created };
      });
      captured = placed.captured;
      order = placed.order;
    } catch (error) {
      if (error instanceof StockConflictError) {
        return NextResponse.json(
          { error: 'Something just sold out — check the shelf and try again' },
          { status: 409 },
        );
      }
      throw error;
    }

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
      message: `${captured.name} (${captured.phone}) ordered ${summary}${
        fulfillmentMethod === 'LOCAL_DELIVERY' ? ' for local delivery' : ' for pickup'
      }. #${order.orderNumber}`,
      customerId: captured.id,
      orderId: order.id,
    });

    // Operator alert: the sale ping the admin's ALERTS panel receives.
    await captureAdminAlert({
      kind: 'ORDER',
      title: `New order · GH₵${(amountPesewas / 100).toFixed(2)}`,
      body: `${store.name} · ${captured.name} · ${summary}`,
      amountPesewas,
      refType: 'order',
      refId: order.id,
    });

    const lowStock = lines.flatMap((line) => {
      if (line.item.stock == null) return [];
      const remaining = line.item.stock - line.quantity;
      return remaining <= 2 ? [{ name: line.item.name, stock: remaining }] : [];
    });
    await Promise.all([
      sendOrderAlert({
        userId: store.userId,
        storeName: store.name,
        orderNumber: order.orderNumber,
        customerName: captured.name,
        customerPhone: captured.phone,
        amountPesewas,
        lines: lines.map((line) => ({ name: line.item.name, quantity: line.quantity })),
        lowStock,
      }),
      sendPushToUser(store.userId, {
        title: `New order · ${formatGhs(amountPesewas)}`,
        body: `${captured.name} ordered ${summary}. #${order.orderNumber}`.slice(0, 480),
        url: '/dashboard/orders',
        tag: `order-${order.id}`,
      }),
    ]);

    // Auto-dispatch is best-effort: the order is already placed, and a push or
    // dispatch hiccup must never turn a successful checkout into an error.
    if (fulfillmentMethod === 'LOCAL_DELIVERY' && store.autoDispatch) {
      await dispatchOrder(order.id).catch(() => undefined);
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ?? new URL(request.url).origin;
    const trackingUrl = `${origin}/track/${encodeURIComponent(signOrderToken(order.id))}`;
    return NextResponse.json(
      PublicOrderResult.parse({
        ok: true,
        order: serializeOrder(order),
        customerId: captured.id,
        createdCustomer: captured.created,
        trackingUrl,
      }),
      { status: 201 },
    );
  } catch (error) {
    return routeErrorResponse(error, request);
  }
}
