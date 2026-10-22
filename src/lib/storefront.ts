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

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { toE164 } from '@/lib/phone';

export type CapturedCustomer = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  created: boolean;
};

// Where the person entered the shop. `Owner` is set by the dashboard's own
// customers route and never by this module — everything here is storefront.
export type StorefrontSource = 'LEAD' | 'ORDER';

/**
 * Find by E.164 phone within the owner's shop, or create with the visitor's
 * details, stamped with how they arrived.
 *
 * `source` records FIRST entry and is never overwritten later, so an owner who
 * typed a contact in by hand keeps `OWNER` even if that person later shops on
 * the storefront. What DOES change on a repeat capture is the inquiry counter:
 * every lead-form submission bumps `inquiryCount` and `lastInquiryAt`, which is
 * the number behind the platform's inquiry rate. Placing an order is a purchase,
 * not an enquiry, so `ORDER` leaves the counter alone.
 */
export async function findOrCreateCustomer(
  input: {
    userId: string;
    name: string;
    phone: string;
    town?: string;
    note?: string | null;
    source?: StorefrontSource;
  },
  // Order placement passes its interactive transaction client so the customer
  // row commits or rolls back together with the stock decrement and the order.
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CapturedCustomer> {
  const phone = toE164(input.phone);
  const source: StorefrontSource = input.source ?? 'LEAD';
  const note = input.note?.trim() || null;
  const isEnquiry = source === 'LEAD';
  const existing = await db.customer.findFirst({
    where: { phone, userId: input.userId },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    // Work out the delta first — an unchanged row is not worth a write.
    const patch: Prisma.CustomerUpdateInput = {
      ...(isEnquiry ? { inquiryCount: { increment: 1 }, lastInquiryAt: new Date() } : {}),
      ...(note ? { note } : {}),
      // Rows written before this column existed still need an origin.
      ...(existing.source === 'UNKNOWN' ? { source } : {}),
    };
    if (Object.keys(patch).length > 0) {
      await db.customer.update({ where: { id: existing.id }, data: patch });
    }
    return {
      id: existing.id,
      name: existing.name,
      phone,
      address: existing.address,
      created: false,
    };
  }
  const created = await db.customer.create({
    data: {
      userId: input.userId,
      name: input.name.trim(),
      phone,
      address: input.town?.trim() || null,
      source,
      note,
      inquiryCount: isEnquiry ? 1 : 0,
      lastInquiryAt: isEnquiry ? new Date() : null,
    },
  });
  return { id: created.id, name: created.name, phone, address: created.address, created: true };
}

/** Order numbers read "TILZA-YYYMMDD-XXXX" — same format as the owner-side route. */
export function buildOrderNumber(now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `TILZA-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
