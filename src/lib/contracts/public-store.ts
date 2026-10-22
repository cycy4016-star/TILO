// Client-safe contracts for the public storefront's self-serve flows: visitors
// place orders on Tilza or leave their details, both landing straight in the
// owner's customers list with a live notification.
import { z } from 'zod';
import { PublicOrderCourier } from '@/lib/contracts/courier';
import { DeliveryStatus, FulfillmentMethod, OrderItem, OrderStatus } from '@/lib/contracts/order';

// One line in a storefront basket. The basket is a list of these, so a visitor
// can push several products into one order instead of starting over each time.
export const PublicOrderLine = z.object({
  itemId: z.string().trim().min(1, 'Item is required'),
  quantity: z.number().int('Quantity must be a whole number').min(1).max(99).default(1),
});

// The next step after either capture is a reply on WhatsApp/SMS, so the number
// has to actually dial: at least 9 digits once formatted is what wa.me accepts
// and what the server-side `toE164` normalisation turns into a real E.164
// number. Without this a typo silently becomes an unreachable customer row.
const phoneField = z
  .string()
  .trim()
  .min(1, 'A phone number is needed')
  .max(40, 'Phone is too long')
  .refine((value) => value.replace(/\D/g, '').length >= 9, 'That phone number looks too short');

// An order placed on the storefront, no account needed. Just the basket +
// who they are. Phones are normalised to E.164 server-side before saving.
export const PublicOrderCreate = z
  .object({
    lines: z
      .array(PublicOrderLine)
      .min(1, 'Add at least one item')
      .max(20, 'Keep the basket to 20 different items'),
    customerName: z.string().trim().min(1, 'Your name is needed').max(120, 'Name is too long'),
    phone: phoneField,
    note: z.string().trim().max(300, 'Keep the note under 300 characters').optional(),
    // Optional coupon typed in the basket. The server re-validates it against
    // live promotions and prices the discount itself; the client preview is
    // never trusted.
    code: z.string().trim().max(40, 'Code is too long').optional(),
    // Fulfillment branch. The client previews the delivery fee, but the order
    // route recomputes it from the shop's live coordinates before charging.
    fulfillmentMethod: FulfillmentMethod.default('DIRECT_PICKUP'),
    // Exact pinned entrance for LOCAL_DELIVERY. Pickup orders never need these.
    customerLat: z.number().finite().min(-90).max(90).optional(),
    customerLng: z.number().finite().min(-180).max(180).optional(),
  })
  .superRefine((value, ctx) => {
    // Two lines for the same product would snapshot it twice in the order
    // history; the cart maths that produces this should never manage it, so a
    // crafted payload is a client bug worth surfacing rather than quietly
    // doubling the total.
    const seen = new Set<string>();
    for (const [index, line] of value.lines.entries()) {
      if (seen.has(line.itemId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lines', index, 'itemId'],
          message: 'That item is already in the basket',
        });
      }
      seen.add(line.itemId);
    }

    if (value.fulfillmentMethod === 'LOCAL_DELIVERY') {
      if (value.customerLat === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customerLat'],
          message: 'Allow location access so we can price the delivery.',
        });
      }
      if (value.customerLng === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customerLng'],
          message: 'Allow location access so we can price the delivery.',
        });
      }
    }
  });

export const PublicOrderResult = z.object({
  ok: z.literal(true),
  order: OrderItem,
  customerId: z.string(),
  createdCustomer: z.boolean(),
  // Signed, account-free link the buyer can reopen after the receipt closes.
  trackingUrl: z.string().url(),
});

// What an unauthenticated buyer may see at /track/[token]. Deliberately no
// customer name, phone, address, coordinates, payment, or internal ids.
export const PublicOrderTracking = z.object({
  orderNumber: z.string(),
  storeName: z.string(),
  storeSlug: z.string(),
  storePhone: z.string().nullable(),
  storeAddress: z.string().nullable(),
  storeLat: z.number().nullable(),
  storeLng: z.number().nullable(),
  status: OrderStatus,
  fulfillmentMethod: FulfillmentMethod,
  deliveryStatus: DeliveryStatus,
  // Rider identity and last-known position after acceptance. Null until a
  // courier is assigned; the exact buyer pin is never returned here.
  courier: PublicOrderCourier.nullable(),
  // Six-digit handoff code the buyer reads to the courier at the door. Only
  // exposed after acceptance, and never in logs.
  handoffCode: z.string().nullable(),
  buyerConfirmedAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
  canConfirm: z.boolean(),
  placedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lines: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().int().positive(),
      lineTotalPesewas: z.number().int().nonnegative(),
    }),
  ),
  totalPesewas: z.number().int().nonnegative().nullable(),
});

// Visitors leaving their details on the storefront. `consent` must be true —
// the card only saves them once they tick the opt-in box.
export const PublicLeadCreate = z.object({
  name: z.string().trim().min(1, 'Your name is needed').max(120, 'Name is too long'),
  phone: phoneField,
  town: z.string().trim().max(120, 'Keep the town short').optional(),
  note: z.string().trim().max(300, 'Keep the note under 300 characters').optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Tick the box so we can save you' }) }),
});

export const PublicLeadResult = z.object({
  ok: z.literal(true),
  customerId: z.string(),
  created: z.boolean(),
});

export type PublicOrderCreateInput = z.infer<typeof PublicOrderCreate>;
export type PublicOrderTracking = z.infer<typeof PublicOrderTracking>;
export type PublicLeadCreateInput = z.infer<typeof PublicLeadCreate>;
