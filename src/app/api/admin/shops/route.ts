// Platform shop table: one row per account with live catalogue + order
// counts, GMV and the last order time. Admin-only cross-shop read.
// `?q=` matches owner name, phone, store name or slug.
import 'server-only';

import { NextResponse } from 'next/server';
import { AdminShops } from '@/lib/contracts/admin';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/require-admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { phoneNumber: { contains: query, mode: 'insensitive' } },
              { store: { name: { contains: query, mode: 'insensitive' } } },
              { store: { slug: { contains: query, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        createdAt: true,
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

    const ids = users.map((user) => user.id);
    const [gmvByUser, unpaidByUser] = await Promise.all([
      prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, status: { not: 'CANCELLED' } },
        _sum: { amountPesewas: true },
        _count: true,
        _max: { createdAt: true },
      }),
      prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, paidAt: null, status: { not: 'CANCELLED' } },
        _count: true,
      }),
    ]);

    const gmv = new Map(gmvByUser.map((row) => [row.userId, row]));
    const unpaid = new Map(unpaidByUser.map((row) => [row.userId, row._count]));

    return NextResponse.json(
      AdminShops.parse({
        total: users.length,
        shops: users.map((user) => {
          const stats = gmv.get(user.id);
          return {
            userId: user.id,
            ownerName: user.name,
            ownerPhone: user.phoneNumber,
            storeName: user.store?.name ?? null,
            slug: user.store?.slug ?? null,
            storeActive: user.store?.active ?? null,
            itemCount: user.store?._count.items ?? 0,
            customerCount: user._count.customers,
            orderCount: user._count.orders,
            unpaidCount: unpaid.get(user.id) ?? 0,
            gmvPesewas: stats?._sum.amountPesewas ?? 0,
            lastOrderAt: stats?._max.createdAt ? stats._max.createdAt.toISOString() : null,
            createdAt: user.createdAt.toISOString(),
          };
        }),
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
