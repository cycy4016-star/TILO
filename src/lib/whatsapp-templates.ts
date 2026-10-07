// WhatsApp message bodies for the storefront. Sibling to sms-templates: same
// brand voice, but wa.me has no 320-char cap, so a full basket can be spelled
// out line by line. Client-safe — the catalogue builds these in the browser.
//
// Money is passed in already formatted (formatGhs) so the templates stay
// formatting-agnostic and trivially unit-testable.

export type ItemOrderContext = {
  storeName: string;
  itemName: string;
  /** Unit price, pre-formatted — plus any "was … (n% off)" tail. */
  priceLabel: string;
  quantity: number;
};

/** Single-item quick order: "Please add for me 2x Shirt — GHS 50.00." */
export function itemOrderWhatsApp(context: ItemOrderContext): string {
  const quantity = context.quantity > 1 ? `${context.quantity}x ` : '';
  return `Hi ${context.storeName}! Please add for me: ${quantity}${context.itemName} — ${context.priceLabel}.`;
}

export type BasketLine = {
  name: string;
  quantity: number;
  /** Line total (unit price x quantity), pre-formatted. */
  amount: string;
};

export type BasketOrderContext = {
  storeName: string;
  orderNumber: string;
  lines: BasketLine[];
  /** Basket total, pre-formatted. */
  total: string;
  customerName: string;
  customerPhone: string;
  note?: string | null;
};

/**
 * The whole basket, sent to the shop after the order is recorded. Carries the
 * order number so the owner can match the chat against the order in Tilo.
 */
export function basketOrderWhatsApp(context: BasketOrderContext): string {
  const parts = [
    `Hi ${context.storeName}! I'd like to place an order.`,
    '',
    `Order ${context.orderNumber}`,
    ...context.lines.map((line) => `${line.quantity}x ${line.name} — ${line.amount}`),
    '',
    `Total: ${context.total}`,
    `Name: ${context.customerName}`,
    `Phone: ${context.customerPhone}`,
  ];
  if (context.note) parts.push(`Note: ${context.note}`);
  parts.push('', 'Please confirm. Thank you!');
  return parts.join('\n');
}
