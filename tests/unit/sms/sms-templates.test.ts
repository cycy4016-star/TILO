import { describe, expect, it } from 'vitest';
import {
  followUpSms,
  orderConfirmationSms,
  orderRequestSms,
  SMS_TEMPLATES,
  welcomeSms,
} from '@/lib/sms-templates';

describe('sms templates', () => {
  const context = { storeName: 'Kente Kitchen', customerName: 'Ama' };

  it('builds an on-brand order request for sms: deep links', () => {
    const message = orderRequestSms({
      storeName: 'Kente Kitchen',
      itemName: 'Branded apron',
      priceGhs: 'GH₵ 45.00',
      quantity: 2,
    });
    expect(message).toContain('Kente Kitchen');
    expect(message).toContain('2x Branded apron');
    expect(message).toContain('GH₵ 45.00');
  });

  it('confirms an order with the TILO order number and signs the store', () => {
    const message = orderConfirmationSms({
      ...context,
      orderNumber: 'TILO-20260922-A1B2C3D4',
      description: '2x Branded apron',
    });
    expect(message).toContain('TILO-20260922-A1B2C3D4');
    expect(message).toContain('- Kente Kitchen');
  });

  it('greets a fresh visitor who opted in', () => {
    expect(welcomeSms(context)).toContain('Hello Ama');
    expect(welcomeSms(context)).toContain('- Kente Kitchen');
  });

  it('builds a gentle follow-up nudge', () => {
    const message = followUpSms(context);
    expect(message).toContain('Kente Kitchen');
    expect(message).toContain('Hello Ama');
  });

  it('keeps every template under the 320-char SMS cap', () => {
    const messages = [
      orderRequestSms({
        storeName: 'Kente Kitchen',
        itemName: 'Long-named branded apron with an even longer description',
        priceGhs: 'GH₵ 60.00',
        quantity: 99,
      }),
      orderConfirmationSms({
        ...context,
        orderNumber: 'TILO-20260922-A1B2C3D4',
        description: '99x Long-named branded apron with an even longer description',
      }),
      welcomeSms(context),
      followUpSms(context),
    ];
    for (const message of messages) expect(message.length).toBeLessThanOrEqual(320);
  });

  it('exposes a stable template picker for the composer', () => {
    expect(Object.fromEntries(SMS_TEMPLATES.map((entry) => [entry.key, entry.label]))).toEqual({
      welcome: 'Welcome',
      'follow-up': 'Follow-up',
    });
    expect(SMS_TEMPLATES[0].build(context).length).toBeLessThanOrEqual(320);
  });
});
