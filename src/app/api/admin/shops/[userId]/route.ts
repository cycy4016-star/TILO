// Platform dossier on one account: identity, storefront, live counts, top
// items by revenue and the freshest orders, customers and SMS rows.
// Admin-only cross-shop read.
import 'server-only';

import { NextResponse } from 'next/server';
import { AdminShopDetail } from '@/lib/contracts/admin';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdminUser(request);
    const { userId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        phoneNumberVerified: true,
        role: true,
        banned: true,
        createdAt: true,
        sessions: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        store: {
          select: {
            name: true,
            slug: true,
            active: true,
            _count: { select: { items: true } },
          },
        },
        _count: { select: { customers: true, orders: true } },
      },
    });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [totals, paid, lines, recentOrders, recentCustomers, recentSms] = await Promise.all([
      prisma.order.aggregate({
        _sum: { amountPesewas: true },
        where: { userId, status: { not: 'CANCELLED' }, amountPesewas: { not: null } },
      }),
      prisma.order.aggregate({
        _sum: { amountPesewas: true },
        where: { userId, paidAt: { not: null }, amountPesewas: { not: null } },
      }),
      prisma.orderLineItem.findMany({
        where: { order: { userId, status: { not: 'CANCELLED' } } },
        select: { name: true, quantity: true, unitPricePesewas: true },
        take: 500,
      }),
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          description: true,
          status: true,
          amountPesewas: true,
          paidAt: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      }),
      prisma.customer.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          phone: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.smsUsage.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, to: true, source: true, ok: true, credits: true, createdAt: true },
      }),
    ]);

    const revenueByName = new Map<string, { units: number; revenue: number }>();
    for (const line of lines) {
      const entry = revenueByName.get(line.name) ?? { units: 0, revenue: 0 };
      entry.units += line.quantity;
      entry.revenue += line.unitPricePesewas * line.quantity;
      revenueByName.set(line.name, entry);
    }
    const topItems = [...revenueByName]
      .map(([name, stats]) => ({ name, units: stats.units, revenuePesewas: stats.revenue }))
      .sort((a, b) => b.revenuePesewas - a.revenuePesewas)
      .slice(0, 5);

    return NextResponse.json(
      AdminShopDetail.parse({
        userId: user.id,
        ownerName: user.name,
        ownerEmail: user.email,
        ownerPhone: user.phoneNumber,
        phoneVerified: user.phoneNumberVerified,
        role: user.role,
        banned: user.banned ?? false,
        createdAt: user.createdAt.toISOString(),
        lastSeenAt: user.sessions[0] ? user.sessions[0].createdAt.toISOString() : null,
        storeName: user.store?.name ?? null,
        slug: user.store?.slug ?? null,
        storeActive: user.store?.active ?? null,
        itemCount: user.store?._count.items ?? 0,
        customerCount: user._count.customers,
        orderCount: user._count.orders,
        gmvPesewas: totals._sum.amountPesewas ?? 0,
        paidPesewas: paid._sum.amountPesewas ?? 0,
        topItems,
        recentOrders: recentOrders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          description: order.description,
          status: order.status,
          amountPesewas: order.amountPesewas,
          paidAt: order.paidAt ? order.paidAt.toISOString() : null,
          customerName: order.customer?.name ?? null,
          createdAt: order.createdAt.toISOString(),
        })),
        recentCustomers: recentCustomers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          orderCount: customer._count.orders,
          createdAt: customer.createdAt.toISOString(),
        })),
        recentSms: recentSms.map((sms) => ({
          id: sms.id,
          to: sms.to,
          source: sms.source,
          ok: sms.ok,
          credits: sms.credits,
          createdAt: sms.createdAt.toISOString(),
        })),
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
