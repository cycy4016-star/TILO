import { describe, expect, it } from 'vitest';
import { basketOrderWhatsApp, itemOrderWhatsApp } from '@/lib/whatsapp-templates';

describe('whatsapp templates', () => {
  it('names the item and the shop in a one-off order', () => {
    const message = itemOrderWhatsApp({
      storeName: 'Adom Fabrics',
      itemName: 'Fugu Smock',
      priceLabel: 'GH₵ 450.00, was GH₵ 550.00 (18% off)',
      quantity: 1,
    });
    expect(message).toContain('Adom Fabrics');
    expect(message).toContain('Fugu Smock');
    expect(message).toContain('18% off');
    // A single unit reads naturally without a "1x" prefix.
    expect(message).not.toContain('1x');
  });

  it('carries the quantity once the item is in the basket', () => {
    const message = itemOrderWhatsApp({
      storeName: 'Adom Fabrics',
      itemName: 'Ankara Wax Print (1 yard)',
      priceLabel: 'GH₵ 45.00',
      quantity: 3,
    });
    expect(message).toContain('3x Ankara Wax Print (1 yard)');
  });

  it('spells out the whole basket with the order number to match on', () => {
    const message = basketOrderWhatsApp({
      storeName: 'Adom Fabrics',
      orderNumber: 'TILO-20261005-962D939B',
      lines: [
        { name: 'Kente Strip (1 yard)', quantity: 2, amount: 'GH₵ 240.00' },
        { name: 'Fugu Smock', quantity: 1, amount: 'GH₵ 450.00' },
      ],
      total: 'GH₵ 690.00',
      customerName: 'Ama',
      customerPhone: '0244999888',
      note: 'Please wrap it as a gift',
    });

    expect(message).toContain('Order TILO-20261005-962D939B');
    expect(message).toContain('2x Kente Strip (1 yard) — GH₵ 240.00');
    expect(message).toContain('1x Fugu Smock — GH₵ 450.00');
    expect(message).toContain('Total: GH₵ 690.00');
    expect(message).toContain('Name: Ama');
    expect(message).toContain('Phone: 0244999888');
    expect(message).toContain('Note: Please wrap it as a gift');
  });

  it('leaves the note line out when the shopper had nothing to add', () => {
    const message = basketOrderWhatsApp({
      storeName: 'Adom Fabrics',
      orderNumber: 'TILO-20261005-962D939B',
      lines: [{ name: 'Beaded Necklace', quantity: 1, amount: 'GH₵ 90.00' }],
      total: 'GH₵ 90.00',
      customerName: 'Kwesi',
      customerPhone: '0200000000',
      note: null,
    });
    expect(message).not.toContain('Note:');
    expect(message).toContain('GH₵ 90.00');
  });
});
