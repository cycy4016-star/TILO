// Client-safe contracts for the public storefront's self-serve flows: visitors
// place orders on Tilo or leave their details, both landing straight in the
// owner's customers list with a live notification.
import { z } from 'zod';
import { OrderItem } from '@/lib/contracts/order';

// An order placed on the storefront, no account needed. Just item + qty +
// who they are. Phones are normalised to E.164 server-side before saving.
export const PublicOrderCreate = z.object({
  itemId: z.string().trim().min(1, 'Item is required'),
  quantity: z.number().int('Quantity must be a whole number').min(1).max(99).default(1),
  customerName: z.string().trim().min(1, 'Your name is needed').max(120, 'Name is too long'),
  phone: z.string().trim().min(1, 'A phone number is needed').max(40, 'Phone is too long'),
  note: z.string().trim().max(300, 'Keep the note under 300 characters').optional(),
});

export const PublicOrderResult = z.object({
  ok: z.literal(true),
  order: OrderItem,
  customerId: z.string(),
  createdCustomer: z.boolean(),
});

// Visitors leaving their details on the storefront. `consent` must be true —
// the card only saves them once they tick the opt-in box.
export const PublicLeadCreate = z.object({
  name: z.string().trim().min(1, 'Your name is needed').max(120, 'Name is too long'),
  phone: z.string().trim().min(1, 'A phone number is needed').max(40, 'Phone is too long'),
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
export type PublicLeadCreateInput = z.infer<typeof PublicLeadCreate>;
