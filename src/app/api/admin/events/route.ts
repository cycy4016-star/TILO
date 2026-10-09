// Platform event search: the operator's Splunk-style feed. Merges the newest
// order, SMS-ledger, payment and signup rows into one timestamped stream and
// filters it by free text (`?q=`) and source (`?kind=`). Admin-only.
import 'server-only';

import { NextResponse } from 'next/server';
import { type OpsEvent, OpsEventKind, OpsEvents } from '@/lib/contracts/admin';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';

export const dynamic = 'force-dynamic';

const LIMIT = 40;

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const params = new URL(request.url).searchParams;
    const query = params.get('q')?.trim().toLowerCase() ?? '';
    const kindParam = params.get('kind')?.trim() ?? '';
    const kind = OpsEventKind.safeParse(kindParam).success ? kindParam : '';

    const [orders, smsRows, payments, users] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          orderNumber: true,
          description: true,
          status: true,
          amountPesewas: true,
          paidAt: true,
          createdAt: true,
          customer: { select: { name: true } },
          user: { select: { name: true, store: { select: { name: true } } } },
        },
      }),
      prisma.smsUsage.findMany({
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          to: true,
          source: true,
          provider: true,
          ok: true,
          error: true,
          credits: true,
          createdAt: true,
        },
      }),
      prisma.paymentTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          reference: true,
          amountPesewas: true,
          status: true,
          createdAt: true,
          order: {
            select: {
              orderNumber: true,
              user: { select: { store: { select: { name: true } } } },
            },
          },
        },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, name: true, phoneNumber: true, createdAt: true },
      }),
    ]);

    const events: OpsEvent[] = [
      ...orders.map(
        (order): OpsEvent => ({
          id: `order:${order.id}`,
          ts: order.createdAt.toISOString(),
          kind: 'order',
          shop: order.user.store?.name ?? order.user.name,
          summary: `${order.orderNumber} · ${order.description}`,
          detail: `${order.customer?.name ?? 'Walk-in'} · ${order.status}${order.paidAt ? ' · paid' : ''}`,
          ok: order.status === 'CANCELLED' ? false : null,
        }),
      ),
      ...smsRows.map(
        (sms): OpsEvent => ({
          id: `sms:${sms.id}`,
          ts: sms.createdAt.toISOString(),
          kind: 'sms',
          shop: null,
          summary: `${sms.source} SMS to ${sms.to} via ${sms.provider}`,
          detail: sms.ok
            ? `${sms.credits} credit${sms.credits === 1 ? '' : 's'}`
            : (sms.error ?? 'failed'),
          ok: sms.ok,
        }),
      ),
      ...payments.map(
        (payment): OpsEvent => ({
          id: `payment:${payment.id}`,
          ts: payment.createdAt.toISOString(),
          kind: 'payment',
          shop: payment.order?.user.store?.name ?? null,
          summary: `${payment.reference} · ${payment.status}`,
          detail: payment.order ? `for ${payment.order.orderNumber}` : null,
          ok: payment.status === 'SUCCESS' ? true : payment.status === 'PENDING' ? null : false,
        }),
      ),
      ...users.map(
        (user): OpsEvent => ({
          id: `signup:${user.id}`,
          ts: user.createdAt.toISOString(),
          kind: 'signup',
          shop: user.name,
          summary: `${user.name} joined`,
          detail: user.phoneNumber,
          ok: null,
        }),
      ),
    ];

    const filtered = events
      .filter((event) => (kind ? event.kind === kind : true))
      .filter((event) => {
        if (!query) return true;
        return `${event.summary} ${event.detail ?? ''} ${event.shop ?? ''}`
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => (a.ts < b.ts ? 1 : -1))
      .slice(0, LIMIT);

    return NextResponse.json(OpsEvents.parse({ events: filtered, total: filtered.length }));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
