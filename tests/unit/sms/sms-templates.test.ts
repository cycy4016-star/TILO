import { describe, expect, it } from 'vitest';
import { orderRequestSms } from '@/lib/sms-templates';

describe('sms templates', () => {
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

  it('keeps the request under the 320-char SMS cap', () => {
    const message = orderRequestSms({
      storeName: 'Kente Kitchen',
      itemName: 'Long-named branded apron with an even longer description',
      priceGhs: 'GH₵ 60.00',
      quantity: 99,
    });
    expect(message.length).toBeLessThanOrEqual(320);
  });
});
