// Share plumbing for shops and products: ref-tagged links plus per-channel
// share URLs. Pure and client-safe — the share sheet, the dashboard and the
// tests all build from these. Every message is URI-encoded exactly once, at
// the wa.me / intent boundary.
export type ShareChannel = 'whatsapp' | 'facebook' | 'x' | 'telegram' | 'copy' | 'native';

/** Tag a storefront link with the channel it travels on (`?ref=whatsapp`). */
export function shareUrlWithRef(url: string, channel: ShareChannel): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}ref=${channel}`;
}

export type ShopShareContext = {
  storeName: string;
  storeUrl: string;
  tagline?: string | null;
};

/** "Look at this shop" — name, hook and link, ready for wa.me text. */
export function shopShareMessage(context: ShopShareContext): string {
  const hook = context.tagline?.trim()
    ? `${context.tagline.trim()} — `
    : 'Browse the catalogue and order straight from your phone — ';
  return `${context.storeName}: ${hook}${context.storeUrl}`;
}

export type ProductShareContext = {
  storeName: string;
  itemName: string;
  priceLabel: string;
  itemUrl: string;
};

/** "Look at this product" — name, price and a deep link to its card. */
export function productShareMessage(context: ProductShareContext): string {
  return `${context.itemName} — ${context.priceLabel} at ${context.storeName}: ${context.itemUrl}`;
}

export type PromoShareContext = {
  storeName: string;
  promoName: string;
  headline: string;
  storeUrl: string;
};

/** "Look at this sale" — headline plus where to claim it. */
export function promoShareMessage(context: PromoShareContext): string {
  return `${context.promoName} at ${context.storeName}: ${context.headline}. Shop here: ${context.storeUrl}`;
}

/** Channel share targets. WhatsApp carries the message in the URL; the rest
 *  open their composer (caption handled by copy-link + native share). */
export function shareTargetFor(channel: ShareChannel, message: string, url: string): string | null {
  switch (channel) {
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(message)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`;
    case 'copy':
    case 'native':
      return null;
  }
}

/** Web Share API is a phone-and-modern-browser affair — feature-detect it. */
export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}
