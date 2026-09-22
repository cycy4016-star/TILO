// Shared server-side helpers for the public storefront capture flows
// (order placement + visitor leaves their details). Single source of truth for
// "who is this person" — phone is normalised to E.164 once, and a phone that
// already lives in the wall is reused instead of creating a duplicate.
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

/** Find by E.164 phone, or create with the details the visitor gave. */
export async function findOrCreateCustomer(input: {
  name: string;
  phone: string;
  town?: string;
}): Promise<CapturedCustomer> {
  const phone = toE164(input.phone);
  const existing = await prisma.customer.findFirst({
    where: { phone },
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
