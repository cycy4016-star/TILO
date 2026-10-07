// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CustomerCreate, CustomerDetail, CustomerList } from '@/lib/contracts/customer';
import {
  formatGhs,
  OrderCreate,
  OrderItem,
  OrderList,
  OrderStatus,
  OrderUpdate,
} from '@/lib/contracts/order';

const order = {
  id: 'order-1',
  orderNumber: 'TILO-20260918-ABC12345',
  customerId: 'customer-1',
  description: 'Restock',
  status: 'PENDING' as const,
  amountPesewas: 4550,
  paidAt: null,
  createdAt: '2026-09-18T00:00:00.000Z',
  updatedAt: '2026-09-18T00:00:00.000Z',
};

describe('customer and order contracts', () => {
  it('requires a customer name and at least one contact method', () => {
    expect(CustomerCreate.safeParse({ name: 'Kofi Foods' }).success).toBe(false);
    expect(CustomerCreate.safeParse({ name: '', phone: '024 000 0000' }).success).toBe(false);
    expect(CustomerCreate.safeParse({ name: 'Kofi Foods', phone: '024 000 0000' }).success).toBe(
      true,
    );
    expect(
      CustomerCreate.safeParse({ name: 'Kofi Foods', email: 'orders@example.test' }).success,
    ).toBe(true);
  });

  it('accepts blank optional fields from browser forms', () => {
    const result = CustomerCreate.safeParse({
      name: 'Ama’s Boutique',
      phone: '024 111 2200',
      email: '',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('');
  });

  it('keeps the customer list and detail envelopes typed', () => {
    const customer = {
      id: 'customer-1',
      name: 'Ama’s Boutique',
      company: 'Ama’s Boutique Ltd.',
      email: null,
      phone: '024 111 2200',
      address: 'Osu, Accra',
      orderCount: 1,
      createdAt: '2026-09-18T00:00:00.000Z',
      updatedAt: '2026-09-18T00:00:00.000Z',
    };
    expect(CustomerList.safeParse({ items: [customer] }).success).toBe(true);
    expect(CustomerDetail.safeParse({ ...customer, orders: [order] }).success).toBe(true);
    expect(CustomerList.safeParse({ items: [{ ...customer, id: undefined }] }).success).toBe(false);
  });

  it('limits order writes and statuses to the confirmed contract', () => {
    expect(OrderStatus.options).toEqual(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED']);
    expect(
      OrderCreate.safeParse({ customerId: 'customer-1', description: 'Stock delivery' }).success,
    ).toBe(true);
    expect(
      OrderCreate.parse({ customerId: 'customer-1', description: 'Stock delivery' }).status,
    ).toBe('PENDING');
    expect(OrderCreate.safeParse({ customerId: 'customer-1', description: '' }).success).toBe(
      false,
    );
    expect(
      OrderCreate.safeParse({ customerId: 'customer-1', description: 'x', amountPesewas: 100 })
        .success,
    ).toBe(true);
    expect(
      OrderCreate.safeParse({ customerId: 'customer-1', description: 'x', amountPesewas: -1 })
        .success,
    ).toBe(false);
    expect(OrderUpdate.safeParse({ status: 'SHIPPED' }).success).toBe(false);
    expect(OrderList.safeParse({ items: [] }).success).toBe(true);
    expect(OrderItem.safeParse({ id: 'order-1' }).success).toBe(false);
  });

  it('serializes order items with payment fields', () => {
    expect(OrderItem.safeParse(order).success).toBe(true);
    expect(OrderItem.safeParse({ ...order, amountPesewas: null, paidAt: null }).success).toBe(true);
    expect(OrderItem.safeParse({ ...order, paidAt: '2026-09-19T12:00:00.000Z' }).success).toBe(
      true,
    );
  });

  it('marks and clears payments through a partial update', () => {
    const parse = OrderUpdate.safeParse({ paidAt: '2026-09-19T12:00:00.000Z' });
    expect(parse.success).toBe(true);
    if (parse.success) expect(parse.data.paidAt).toBeTruthy();
    const clear = OrderUpdate.safeParse({ paidAt: null });
    expect(clear.success).toBe(true);
    if (clear.success) expect(clear.data.paidAt).toBeNull();
  });

  it('formats pesewas as cedis', () => {
    expect(formatGhs(4550)).toBe('GH₵ 45.50');
    expect(formatGhs(0)).toBe('GH₵ 0.00');
    expect(formatGhs(null)).toBe('');
  });
});
