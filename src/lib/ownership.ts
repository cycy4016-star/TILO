import 'server-only';

import { prisma } from '@/lib/db';
import type { SessionUser } from '@/lib/require-auth';

/**
 * Tenancy helpers.
 *
 * Every business row (Customer, Order, Store, AutomationRule, Notification)
 * carries a `userId` pointing at the account that owns it. Those columns — not a
 * role — are the isolation boundary: a signed-in shop owner sees and edits only
 * the rows where `userId` matches their session id. This module centralises the
 * lookups so a route cannot accidentally resolve a child row (a store item, a
 * promotion, a social post) by bare id and inherit someone else's shop.
 *
 * `userId` is never returned to the client — it is internal routing, and the
 * response contracts in src/lib/contracts/ don't declare it.
 */

/** The signed-in account's own storefront row, or null if they haven't created one. */
export async function getStoreForUser(userId: string) {
  return prisma.store.findUnique({
    where: { userId },
    include: { items: { orderBy: [{ sortOrder: 'asc' as const }, { name: 'asc' as const }] } },
  });
}

/** Throws a 404 Response unless the customer exists AND belongs to this user. */
export async function requireOwnedCustomer(userId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, userId } });
  if (!customer) {
    throw Response.json({ error: 'Customer not found' }, { status: 404 });
  }
  return customer;
}

/** Throws a 404 Response unless the order exists AND belongs to this user. */
export async function requireOwnedOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { customer: true, lines: true },
  });
  if (!order) {
    throw Response.json({ error: 'Order not found' }, { status: 404 });
  }
  return order;
}

/**
 * Resolve a store child row (item / promotion / post) for the signed-in user.
 *
 * The child is reached THROUGH the owner's store, never by a bare `findUnique` on
 * the child's own id — that is what stops one shop editing another's catalogue by
 * guessing a cuid.
 *
 * @param model  'item' | 'promotion' | 'post'
 */
export async function requireOwnedStoreChild<T extends 'item' | 'promotion' | 'post'>(
  userId: string,
  model: T,
  id: string,
) {
  if (model === 'item') {
    const row = await prisma.storeItem.findFirst({ where: { id, store: { userId } } });
    if (!row) throw Response.json({ error: 'Item not found' }, { status: 404 });
    return row;
  }
  if (model === 'promotion') {
    const row = await prisma.promotion.findFirst({ where: { id, store: { userId } } });
    if (!row) throw Response.json({ error: 'Promo not found' }, { status: 404 });
    return row;
  }
  const row = await prisma.storePost.findFirst({
    where: { id, store: { userId } },
    include: { item: { select: { name: true } } },
  });
  if (!row) throw Response.json({ error: 'Post not found' }, { status: 404 });
  return row;
}

/** The signed-in user's id, for the many routes that only need the ownership key. */
export function ownerId(user: SessionUser): string {
  return user.id;
}
