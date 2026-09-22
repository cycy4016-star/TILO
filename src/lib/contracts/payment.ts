// Client-safe Paystack payment contracts shared by routes and islands.
import { z } from 'zod';

export const PaymentStatus = z.enum(['PENDING', 'SUCCESS', 'FAILED', 'ABANDONED']);

export const PaymentInitialize = z.object({
  orderId: z.string().trim().min(1, 'Order is required'),
});

export const PaymentInitializeResult = z.object({
  authorizationUrl: z.string().url(),
  reference: z.string(),
  amountPesewas: z.number().int().positive(),
});

export const PaymentVerifyResult = z.object({
  reference: z.string(),
  status: PaymentStatus,
  orderId: z.string().nullable(),
  amountPesewas: z.number().int().nonnegative(),
  paidAt: z.string().datetime().nullable(),
});

export const PaymentItem = z.object({
  reference: z.string(),
  status: PaymentStatus,
  orderId: z.string().nullable(),
  amountPesewas: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export const PaymentList = z.object({ items: z.array(PaymentItem) });

export type PaymentStatusValue = z.infer<typeof PaymentStatus>;
export type PaymentInitializeResult = z.infer<typeof PaymentInitializeResult>;
export type PaymentVerifyResult = z.infer<typeof PaymentVerifyResult>;
