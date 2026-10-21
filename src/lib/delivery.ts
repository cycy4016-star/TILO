// Client-safe last-mile pricing. The storefront previews a fee with the same
// pure function; the checkout route re-reads the shop pin from Postgres and
// recomputes it before serializing the order, so the client number is advisory
// only.
//
// No external distance API: straight-line Haversine distance with a localized
// base + per-km matrix. Fees are returned in integer pesewas.

const EARTH_RADIUS_KM = 6371;

/** Base fee covers the first `INCLUDED_KM` kilometres. */
export const DELIVERY_BASE_FEE_GHS = 15;
export const DELIVERY_PER_KM_FEE_GHS = 4;
export const DELIVERY_CONVENIENCE_MARKUP_GHS = 2;
export const DELIVERY_INCLUDED_KM = 3;

export type Coordinates = { lat: number; lng: number };

export function hasCoordinates(
  value: Partial<Coordinates> | null | undefined,
): value is Coordinates {
  return (
    value != null &&
    typeof value.lat === 'number' &&
    Number.isFinite(value.lat) &&
    typeof value.lng === 'number' &&
    Number.isFinite(value.lng)
  );
}

/** Great-circle distance in kilometres between two WGS84 points. */
export function haversineDistanceKm(
  shopLat: number,
  shopLng: number,
  customerLat: number,
  customerLng: number,
): number {
  const dLat = ((customerLat - shopLat) * Math.PI) / 180;
  const dLng = ((customerLng - shopLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((shopLat * Math.PI) / 180) *
      Math.cos((customerLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Distance-based fee in pesewas. Base + convenience markup always apply; only
 * the kilometres beyond the included radius are charged per km.
 */
export function calculateDeliveryFee(
  shopLat: number,
  shopLng: number,
  customerLat: number,
  customerLng: number,
): number {
  const distanceKm = haversineDistanceKm(shopLat, shopLng, customerLat, customerLng);
  let totalFeeGhs = DELIVERY_BASE_FEE_GHS + DELIVERY_CONVENIENCE_MARKUP_GHS;
  if (distanceKm > DELIVERY_INCLUDED_KM) {
    totalFeeGhs += (distanceKm - DELIVERY_INCLUDED_KM) * DELIVERY_PER_KM_FEE_GHS;
  }
  return Math.round(totalFeeGhs * 100);
}

/** Native maps link for the customer's pinned entrance. */
export function deliveryLocationUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Native turn-by-turn handoff from the shop to the customer. */
export function deliveryDirectionsUrl(
  shopLat: number,
  shopLng: number,
  customerLat: number,
  customerLng: number,
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${shopLat},${shopLng}&destination=${customerLat},${customerLng}&travelmode=driving`;
}
