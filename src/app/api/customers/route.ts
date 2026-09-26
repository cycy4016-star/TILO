// authenticated customer list and create API.
import 'server-only';

import { NextResponse } from 'next/server';
import {
  CustomerCreate,
  CustomerItem,
  CustomerList,
  CustomerListQuery,
} from '@/lib/contracts/customer';
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

function serializeCustomer(customer: {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { orders: number };
}) {
  return CustomerItem.parse({
    id: customer.id,
    name: customer.name,
    company: customer.company,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    orderCount: customer._count.orders,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  });
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const parsedQuery = CustomerListQuery.safeParse({
      q: url.searchParams.get('q') || undefined,
    });
    if (!parsedQuery.success) return validationResponse(parsedQuery.error);

    const q = parsedQuery.data.q;
    const customers = await prisma.customer.findMany({
      // Tenancy: only this shop's own customers are ever listed.
      where: {
        userId: user.id,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { company: { contains: q, mode: 'insensitive' as const } },
                { email: { contains: q, mode: 'insensitive' as const } },
                { phone: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
      take: 100,
      include: { _count: { select: { orders: true } } },
    });

    return NextResponse.json(CustomerList.parse({ items: customers.map(serializeCustomer) }));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ errors: { form: 'Invalid JSON payload' } }, { status: 400 });
    }
    const parsed = CustomerCreate.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    const customer = await prisma.customer.create({
      // userId is stamped from the session, never from the request body, so a
      // client cannot create a row inside another shop.
      data: { ...parsed.data, userId: user.id },
      include: { _count: { select: { orders: true } } },
    });
    return NextResponse.json(serializeCustomer(customer), { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
