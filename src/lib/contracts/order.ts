// client-safe order contracts shared by routes and islands.
import { z } from 'zod';

export const OrderStatus = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED']);

// Amounts travel as whole cedis in forms and pesewas on the wire? No — keep one
// unit everywhere: pesewas (ints). The UI shows GHS via formatGhs().

// One productized row on an order: which store item (by id) and how many. The
// API snaps the item's current price + cost into history at creation time.
export const OrderLineInput = z.object({
  storeItemId: z.string().trim().min(1, 'Item is required'),
  quantity: z.number().int('Quantity must be a whole number').min(1, 'At least 1').max(10_000),
});

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
  // Productized rows. Optional: manual/simple orders can still carry just a
  // description + amount. When present, each row snaps name/price/cost.
  lines: z.array(OrderLineInput).max(50, 'Too many lines').optional(),
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

// Snapshotted productized row, as returned with an order. Unit price/cost are
// frozen values from sale time (not the live StoreItem).
export const OrderLineItem = z.object({
  id: z.string(),
  orderId: z.string(),
  storeItemId: z.string().nullable(),
  name: z.string(),
  unitPricePesewas: z.number().int().nonnegative(),
  unitCostPesewas: z.number().int().nonnegative().nullable(),
  quantity: z.number().int().positive(),
  lineTotalPesewas: z.number().int().nonnegative(),
});

// Order rows carry the customer's name so the orders hub (~/dashboard/orders)
// can show who the order belongs to without a second round trip.
export const OrderListItem = OrderItem.extend({
  customerName: z.string(),
  lines: z.array(OrderLineItem),
});

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
export type OrderLineInput = z.infer<typeof OrderLineInput>;
export type OrderUpdateInput = z.infer<typeof OrderUpdate>;
export type OrderItem = z.infer<typeof OrderItem>;
export type OrderLineItem = z.infer<typeof OrderLineItem>;
export type OrderListItem = z.infer<typeof OrderListItem>;
export type OrderList = z.infer<typeof OrderList>;
