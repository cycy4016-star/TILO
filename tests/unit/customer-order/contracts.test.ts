// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  AUTOMATION_KIND_META,
  AutomationKind,
  AutomationRuleCreate,
  AutomationRuleItem,
} from '@/lib/contracts/automation';
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

describe('automation contracts', () => {
  it('plugs in the full automation catalogue', () => {
    expect(AutomationKind.options.sort()).toEqual(
      [
        'SMS_NUDGE',
        'STATUS_FLIP',
        'READY_PING',
        'STALL_ALERT',
        'PAYMENT_CONFIRMED',
        'PAYMENT_REMINDER',
        'REVIEW_REQUEST',
        'RE_ENGAGE',
      ].sort(),
    );
    for (const kind of AutomationKind.options) {
      expect(AUTOMATION_KIND_META[kind]).toBeDefined();
    }
  });

  it('accepts an event-like rule without a trigger status', () => {
    const result = AutomationRuleCreate.safeParse({
      name: 'Chase the unpaid',
      kind: 'PAYMENT_REMINDER',
      waitHours: 48,
    });
    expect(result.success).toBe(true);
  });

  it('requires the recipient for owner-facing alerts', () => {
    expect(
      AutomationRuleCreate.safeParse({
        name: 'Panic',
        kind: 'STALL_ALERT',
        waitHours: 24,
        triggerStatus: 'PENDING',
      }).success,
    ).toBe(false);
    expect(
      AutomationRuleCreate.safeParse({
        name: 'Panic',
        kind: 'STALL_ALERT',
        waitHours: 24,
        triggerStatus: 'PENDING',
        recipient: '+233 24 000 0000',
      }).success,
    ).toBe(true);
  });

  it('requires a target status for auto-flips', () => {
    expect(
      AutomationRuleCreate.safeParse({ name: 'Flip', kind: 'STATUS_FLIP', waitHours: 24 }).success,
    ).toBe(false);
    expect(
      AutomationRuleCreate.safeParse({
        name: 'Flip',
        kind: 'STATUS_FLIP',
        waitHours: 24,
        targetStatus: 'PROCESSING',
        triggerStatus: 'PENDING',
      }).success,
    ).toBe(true);
  });

  it('serializes a rule with a nullable trigger status and recipient', () => {
    const rule = {
      id: 'rule-1',
      name: 'Chase the unpaid',
      kind: 'PAYMENT_REMINDER',
      triggerStatus: null,
      waitHours: 48,
      message: null,
      recipient: null,
      targetStatus: null,
      enabled: true,
      createdAt: '2026-09-18T00:00:00.000Z',
      updatedAt: '2026-09-18T00:00:00.000Z',
    };
    expect(AutomationRuleItem.safeParse(rule).success).toBe(true);
  });
});
