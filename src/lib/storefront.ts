// Shared server-side helpers for the public storefront capture flows
// (order placement + visitor leaves their details). Single source of truth for
// "who is this person" — phone is normalised to E.164 once, and a phone that
// already lives in THIS SHOP's wall is reused instead of creating a duplicate.
//
// Tenancy: `userId` is required and always the resolved storefront's owner (see
// /api/public/store/[slug]/*). The phone lookup is scoped to that owner, so the
// same person buying from two different shops is two separate customer records —
// a shop can never attach an order to a rival's existing customer, which would
// expose that customer's address and order history.
import 'server-only';

import { prisma } from '@/lib/db';
import { toE164 } from '@/lib/phone';

export type CapturedCustomer = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  created: boolean;
};

/** Find by E.164 phone within the owner's shop, or create with the visitor's details. */
export async function findOrCreateCustomer(input: {
  userId: string;
  name: string;
  phone: string;
  town?: string;
}): Promise<CapturedCustomer> {
  const phone = toE164(input.phone);
  const existing = await prisma.customer.findFirst({
    where: { phone, userId: input.userId },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      phone,
      address: existing.address,
      created: false,
    };
  }
  const created = await prisma.customer.create({
    data: {
      userId: input.userId,
      name: input.name.trim(),
      phone,
      address: input.town?.trim() || null,
    },
  });
  return { id: created.id, name: created.name, phone, address: created.address, created: true };
}

/** Order numbers read "TILO-YYYMMDD-XXXX" — same format as the owner-side route. */
export function buildOrderNumber(now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `TILO-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
