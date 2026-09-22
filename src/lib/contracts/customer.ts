// client-safe customer contracts shared by routes and islands.
import { z } from 'zod';

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional();

export const CustomerCreate = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
    company: optionalText(120, 'Company name is too long'),
    email: z
      .union([z.string().trim().email('Enter a valid email address'), z.literal('')])
      .optional(),
    phone: optionalText(40, 'Phone number is too long'),
    address: optionalText(300, 'Address is too long'),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: 'Add an email address or phone number',
    path: ['email'],
  });

export const CustomerItem = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  orderCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CustomerList = z.object({ items: z.array(CustomerItem) });

export const CustomerListQuery = z.object({
  q: z.string().trim().max(80, 'Search is too long').optional(),
});

export const CustomerDetail = CustomerItem.extend({
  orders: z.array(
    z.object({
      id: z.string(),
      orderNumber: z.string(),
      customerId: z.string(),
      description: z.string(),
      status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED']),
      amountPesewas: z.number().int().nonnegative().nullable(),
      paidAt: z.string().datetime().nullable(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    }),
  ),
});

export type CustomerCreateInput = z.infer<typeof CustomerCreate>;
export type CustomerItem = z.infer<typeof CustomerItem>;
export type CustomerList = z.infer<typeof CustomerList>;
export type CustomerDetail = z.infer<typeof CustomerDetail>;
