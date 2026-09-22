// Client-safe phone helpers shared by islands and transport code. No server-only
// imports here — the UI uses these to build wa.me chat links.

// Normalise local Ghana numbers to +233 E.164:
//   0241234567      -> +233241234567
//   233241234567    -> +233241234567
//   +233241234567   -> unchanged
export function toE164(input: string): string {
  let digits = input.replace(/[^0-9+]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('233')) return `+${digits}`;
  if (digits.startsWith('0')) return `+233${digits.slice(1)}`;
  return `+233${digits}`;
}

// wa.me deep link for a stored phone. Returns null when there is no usable
// number so callers can hide the chat button instead of rendering a dead link.
export function waMeLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const e164 = toE164(phone);
  const digitsOnly = e164.replace(/\D/g, '');
  if (digitsOnly.length < 9) return null;
  return `https://wa.me/${digitsOnly}`;
}

// wa.me deep link with a pre-filled message — the storefront's "Order on
// WhatsApp" buttons carry the item + price this way.
export function waMessageLink(phone: string | null | undefined, text: string): string | null {
  const base = waMeLink(phone);
  if (!base) return null;
  return `${base}?text=${encodeURIComponent(text)}`;
}

// sms: deep link with a pre-filled body — the storefront's "Order via SMS"
// buttons carry the TILO-template order message to the customer's composer.
// Returns null when there is no usable number.
export function smsLink(phone: string | null | undefined, text: string): string | null {
  if (!phone) return null;
  const e164 = toE164(phone);
  if (e164.replace(/\D/g, '').length < 9) return null;
  return `sms:${e164}${text ? `?body=${encodeURIComponent(text)}` : ''}`;
}
