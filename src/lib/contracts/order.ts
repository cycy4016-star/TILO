// client-safe order contracts shared by routes and islands.
import { z } from 'zod';

export const OrderStatus = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED']);

// Amounts travel as whole cedis in forms and pesewas on the wire? No — keep one
// unit everywhere: pesewas (ints). The UI shows GHS via formatGhs().
export const OrderCreate = z.object({
  customerId: z.string().trim().min(1, 'Customer is required'),
  description: z
    .string()
    .trim()
    .min(1, 'Order description is required')
    .max(240, 'Description is too long'),
  status: OrderStatus.default('PENDING'),
  amountPesewas: z
    .number()
    .int('Amount must be a whole number')
    .nonnegative('Amount cannot be negative')
    .max(100_000_000, 'Amount too large')
    .optional(),
});

// PATCH body: any subset of mutable order fields. `paidAt` null clears the
// payment, an ISO string marks it paid (UI sends a fresh timestamp on demand).
export const OrderUpdate = z.object({
  status: OrderStatus.optional(),
  amountPesewas: z
    .number()
    .int('Amount must be a whole number')
    .nonnegative('Amount cannot be negative')
    .max(100_000_000, 'Amount too large')
    .optional(),
  paidAt: z.string().datetime().nullable().optional(),
});

export const OrderStatusUpdate = z.object({ status: OrderStatus });

export const OrderItem = z.object({
  id: z.string(),
  orderNumber: z.string(),
  customerId: z.string(),
  description: z.string(),
  status: OrderStatus,
  amountPesewas: z.number().int().nonnegative().nullable(),
  paidAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// List rows carry the customer's name so the orders hub (~/dashboard/orders)
// can show who the order belongs to without a second round trip.
export const OrderListItem = OrderItem.extend({ customerName: z.string() });

export const OrderList = z.object({ items: z.array(OrderListItem) });

export const OrderListQuery = z.object({
  customerId: z.string().trim().min(1).optional(),
  status: OrderStatus.optional(),
  // Free-text hunt across the order number, the description, and the
  // customer's name.
  q: z.string().trim().max(80).optional(),
});

export function formatGhs(pesewas: number | null | undefined): string {
  if (pesewas == null) return '';
  const cedis = pesewas / 100;
  return `GH₵ ${cedis.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type OrderStatusValue = z.infer<typeof OrderStatus>;
export type OrderCreateInput = z.infer<typeof OrderCreate>;
export type OrderUpdateInput = z.infer<typeof OrderUpdate>;
export type OrderItem = z.infer<typeof OrderItem>;
export type OrderListItem = z.infer<typeof OrderListItem>;
export type OrderList = z.infer<typeof OrderList>;
