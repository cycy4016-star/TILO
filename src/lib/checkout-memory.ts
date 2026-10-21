export type SavedCheckoutContact = {
  name: string;
  phone: string;
};

export type LastOrderLine = {
  itemId: string;
  name: string;
  quantity: number;
};

export type LastOrder = {
  orderNumber: string;
  placedAt: string;
  lines: LastOrderLine[];
};

export function checkoutMemoryKey(slug: string): string {
  return `tilza:checkout:${slug}`;
}

export function lastOrderMemoryKey(slug: string): string {
  return `tilza:last-order:${slug}`;
}
