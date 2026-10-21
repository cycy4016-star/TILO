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

/** A warm check-in the owner can send after a sale. Editable before sending. */
export function customerFollowUpWhatsApp(customerName: string): string {
  const firstName = customerName.trim().split(/\s+/)[0] || 'there';
  return `Hi ${firstName}! Thank you for your recent order. Just checking in — did everything arrive as expected? If you need anything else, reply here and I'll help right away.`;
}

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
  /** Coupon code carried on the order, when one was used. */
  discountLabel?: string | null;
  /** Money taken off, pre-formatted. Omitted when there was no coupon. */
  discountAmount?: string | null;
  /** Local-delivery fee, pre-formatted. Omitted for pickup orders. */
  deliveryFee?: string | null;
  /** Google Maps pin for the customer's delivery entrance. */
  deliveryLocationUrl?: string | null;
  /** Amount payable after the discount and delivery fee, pre-formatted. */
  total: string;
  customerName: string;
  customerPhone: string;
  note?: string | null;
};

/**
 * The whole basket, sent to the shop after the order is recorded. Carries the
 * order number so the owner can match the chat against the order in Tilza.
 */
export function basketOrderWhatsApp(context: BasketOrderContext): string {
  const parts = [
    `Hi ${context.storeName}! I'd like to place an order.`,
    '',
    `Order ${context.orderNumber}`,
    ...context.lines.map((line) => `${line.quantity}x ${line.name} — ${line.amount}`),
    '',
    ...(context.discountAmount
      ? [
          context.discountLabel
            ? `Discount (${context.discountLabel}): -${context.discountAmount}`
            : `Discount: -${context.discountAmount}`,
        ]
      : []),
    ...(context.deliveryFee ? [`Delivery Fee (Local Dispatch) - ${context.deliveryFee}`] : []),
    `Total: ${context.total}`,
    `Name: ${context.customerName}`,
    `Phone: ${context.customerPhone}`,
  ];
  if (context.note) parts.push(`Note: ${context.note}`);
  if (context.deliveryLocationUrl) {
    parts.push('', `Delivery Location Link: ${context.deliveryLocationUrl}`);
  }
  parts.push('', 'Please confirm. Thank you!');
  return parts.join('\n');
}
