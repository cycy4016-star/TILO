// authenticated customer detail API.
import 'server-only';

import { NextResponse } from 'next/server';
import { CustomerDetail } from '@/lib/contracts/customer';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ customerId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireAuth(request);
    const { customerId } = await context.params;
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        _count: { select: { orders: true } },
        orders: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    return NextResponse.json(
      CustomerDetail.parse({
        id: customer.id,
        name: customer.name,
        company: customer.company,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        orderCount: customer._count.orders,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
        orders: customer.orders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          description: order.description,
          status: order.status,
          amountPesewas: order.amountPesewas ?? null,
          paidAt: order.paidAt ? order.paidAt.toISOString() : null,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
        })),
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
