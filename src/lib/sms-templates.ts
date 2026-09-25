// The TILO message voice: every outbound SMS is built here so the storefront,
// the owner composer and the order confirmations all read as one brand. All
// functions are client-safe (used by sms: deep links on the storefront too).
// Messages stay well under the 320-char SMS cap (1–2 credits on Arkesel).

const sign = (storeName: string) => `- ${storeName}`;

export type OrderRequestContext = {
  storeName: string;
  itemName: string;
  priceGhs: string;
  quantity: number;
};

/** Storefront sms: deep-link prefill — "I'd like <qty>x <item> (<price>)". */
export function orderRequestSms(ctx: OrderRequestContext): string {
  return `Hi ${ctx.storeName}! I'd like ${ctx.quantity}x ${ctx.itemName} (${ctx.priceGhs}). Please confirm.`;
}

export type ManageContext = { storeName: string; customerName: string };

/** Owner → customer after their order lands: order number + what's being prepared. */
export function orderConfirmationSms(
  input: ManageContext & { orderNumber: string; description: string },
): string {
  const { storeName, orderNumber, description } = input;
  return `Hello! Your order ${orderNumber} (${description}) is being prepared. We'll ping you when it's ready. ${sign(
    storeName,
  )}`;
}

/** Owner → fresh visitor captured on the storefront (opt-in consent given). */
export function welcomeSms(context: ManageContext): string {
  const { storeName, customerName } = context;
  return `Hello ${customerName}! You're on ${storeName}'s list now. Want to place an order? We take it from there. ${sign(
    storeName,
  )}`;
}

/** Generic owner → customer nudge from the composer. */
export function followUpSms(context: ManageContext): string {
  const { storeName, customerName } = context;
  return `Hello ${customerName}! ${storeName} here. Anything you'd like to order this week? We handle the rest. ${sign(
    storeName,
  )}`;
}

/** The composer's template picker — every entry shares one context shape. */
export const SMS_TEMPLATES = [
  { key: 'welcome', label: 'Welcome', build: (c: ManageContext) => welcomeSms(c) },
  { key: 'follow-up', label: 'Follow-up', build: (c: ManageContext) => followUpSms(c) },
] as const;

export type SmsTemplateKey = (typeof SMS_TEMPLATES)[number]['key'];
