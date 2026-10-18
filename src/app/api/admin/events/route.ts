// Platform event search: the operator's Splunk-style feed. Merges the newest
// order, SMS-ledger, payment, signup, sign-in, shop-opening, lead-capture,
// incident and feedback rows into one timestamped stream and filters it by
// free text (`?q=`) and source (`?kind=`). Admin-only.
import 'server-only';

import { NextResponse } from 'next/server';
import { type OpsEvent, OpsEventKind, OpsEvents } from '@/lib/contracts/admin';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';
import { routeErrorResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

const LIMIT = 40;

// "Edge 120"-style label from a user-agent string — enough context for the
// operator without pasting raw headers into the tape.
const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\/(\d+)/, 'Edge'],
  [/OPR\/(\d+)/, 'Opera'],
  [/Chrome\/(\d+)/, 'Chrome'],
  [/Firefox\/(\d+)/, 'Firefox'],
  [/Version\/(\d+).*Safari/, 'Safari'],
];

function browserOf(userAgent: string | null): string | null {
  if (!userAgent) return null;
  for (const [pattern, name] of BROWSERS) {
    const match = pattern.exec(userAgent);
    if (match) return `${name} ${match[1]}`;
  }
  return null;
}

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const params = new URL(request.url).searchParams;
    const query = params.get('q')?.trim().toLowerCase() ?? '';
    const kindParam = params.get('kind')?.trim() ?? '';
    const kind = OpsEventKind.safeParse(kindParam).success ? kindParam : '';

    const [orders, smsRows, payments, users, signIns, stores, leads, incidents, feedback] =
      await Promise.all([
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
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            createdAt: true,
            store: { select: { name: true } },
          },
        }),
        // Permanent sign-in ledger — each row is one sign-in, and unlike the
        // session it came from it is never deleted on sign-out/expiry.
        prisma.authEvent.findMany({
          where: { kind: 'SIGNIN' },
          orderBy: { createdAt: 'desc' },
          take: 15,
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            user: {
              select: {
                name: true,
                email: true,
                phoneNumber: true,
                store: { select: { name: true } },
              },
            },
          },
        }),
        prisma.store.findMany({
          orderBy: { createdAt: 'desc' },
          take: 15,
          select: {
            id: true,
            name: true,
            slug: true,
            active: true,
            createdAt: true,
            _count: { select: { items: true } },
          },
        }),
        prisma.customer.findMany({
          where: { source: 'LEAD' },
          orderBy: [{ lastInquiryAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
          take: 15,
          select: {
            id: true,
            name: true,
            phone: true,
            inquiryCount: true,
            createdAt: true,
            lastInquiryAt: true,
            user: { select: { store: { select: { name: true } } } },
          },
        }),
        prisma.appLog.findMany({
          orderBy: { lastSeenAt: 'desc' },
          take: 15,
          select: {
            id: true,
            summary: true,
            message: true,
            route: true,
            method: true,
            source: true,
            count: true,
            resolvedAt: true,
            lastSeenAt: true,
          },
        }),
        prisma.feedback.findMany({
          orderBy: { createdAt: 'desc' },
          take: 15,
          select: {
            id: true,
            kind: true,
            status: true,
            message: true,
            email: true,
            createdAt: true,
            store: { select: { name: true } },
            customer: { select: { name: true } },
          },
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
          // The tape's Shop column tells the operator whether the account has
          // opened a storefront yet; the person's name already rides in the
          // summary, so the columns never repeat the same value.
          shop: user.store?.name ?? 'no shop yet',
          summary: `${user.name} joined`,
          // Account details on the row itself: email + phone, both searchable.
          detail: [user.email, user.phoneNumber].filter(Boolean).join(' · ') || null,
          ok: null,
        }),
      ),
      ...signIns.map(
        (event): OpsEvent => ({
          id: `signin:${event.id}`,
          ts: event.createdAt.toISOString(),
          kind: 'signin',
          shop: event.user.store?.name ?? 'no shop yet',
          summary: `${event.user.name} signed in`,
          // Account details plus a compact device hint: browser name + network,
          // so the operator can spot odd sign-ins without reading a raw UA.
          detail:
            [event.user.email, event.user.phoneNumber, event.ipAddress, browserOf(event.userAgent)]
              .filter(Boolean)
              .join(' · ') || null,
          ok: null,
        }),
      ),
      ...stores.map(
        (store): OpsEvent => ({
          id: `store:${store.id}`,
          ts: store.createdAt.toISOString(),
          kind: 'store',
          shop: store.name,
          summary: `${store.name} opened its storefront`,
          detail: `/${store.slug} · ${store._count.items} item${
            store._count.items === 1 ? '' : 's'
          } · ${store.active ? 'live' : 'closed'}`,
          ok: null,
        }),
      ),
      ...leads.map((lead): OpsEvent => {
        // A returning visitor resurfaces at their latest capture, the same
        // moment the merchant's bell rings for them.
        const lastCapture = lead.lastInquiryAt ?? lead.createdAt;
        return {
          id: `lead:${lead.id}`,
          ts: lastCapture.toISOString(),
          kind: 'lead',
          shop: lead.user.store?.name ?? null,
          summary: `Visitor captured · ${lead.name}`,
          detail: `${lead.phone ?? 'no phone'}${
            lead.inquiryCount > 1 ? ` · ${lead.inquiryCount} inquiries` : ''
          }`,
          ok: null,
        };
      }),
      ...incidents.map((incident): OpsEvent => {
        const headline = incident.summary || incident.message;
        const stats = `${incident.source === 'CLIENT' ? 'browser' : 'server'} · fired ×${incident.count}${
          incident.resolvedAt ? ' · marked resolved' : ' · open'
        }`;
        return {
          id: `error:${incident.id}`,
          ts: incident.lastSeenAt.toISOString(),
          kind: 'error',
          shop: null,
          summary: headline,
          // The human message rides in the detail so it is both visible under
          // the headline and reachable by the free-text search below.
          detail: headline === incident.message ? stats : `${incident.message} · ${stats}`,
          ok: Boolean(incident.resolvedAt),
        };
      }),
      ...feedback.map(
        (report): OpsEvent => ({
          id: `feedback:${report.id}`,
          ts: report.createdAt.toISOString(),
          kind: 'feedback',
          shop: report.store?.name ?? null,
          summary: `${report.kind.toLowerCase()}: ${report.message}`,
          detail: report.customer?.name ?? report.email ?? null,
          ok: report.status === 'RESOLVED' ? true : report.status === 'NEW' ? false : null,
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
    return routeErrorResponse(error, request);
  }
}
