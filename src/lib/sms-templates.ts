// The TILO message voice for the storefront's sms: deep links. Client-safe
// (used by sms: links on the public catalogue). Messages stay well under the
// 320-char SMS cap.
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
