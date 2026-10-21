import { describe, expect, it } from 'vitest';
import {
  calculateDeliveryFee,
  deliveryDirectionsUrl,
  deliveryLocationUrl,
  hasCoordinates,
  haversineDistanceKm,
} from '@/lib/delivery';

describe('delivery pricing', () => {
  it('measures a known one-degree slice on the equator', () => {
    expect(haversineDistanceKm(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
  });

  it('is symmetric', () => {
    const outbound = haversineDistanceKm(5.6037, -0.187, 6.6885, -1.6244);
    const inbound = haversineDistanceKm(6.6885, -1.6244, 5.6037, -0.187);
    expect(outbound).toBeCloseTo(inbound, 10);
  });

  it('charges the base + convenience markup inside the included radius', () => {
    // ~1.1km — inside the first 3km.
    expect(calculateDeliveryFee(0, 0, 0.01, 0)).toBe(1700);
  });

  it('adds per-km pricing beyond the included radius', () => {
    // ~11.12km — 8.12 chargeable km at GH₵4 + GH₵17 base/markup.
    expect(calculateDeliveryFee(0, 0, 0.1, 0)).toBe(4948);
  });

  it('rounds to whole pesewas', () => {
    const fee = calculateDeliveryFee(5.6037, -0.187, 5.6698, -0.0166);
    expect(Number.isInteger(fee)).toBe(true);
  });

  it('recognises a complete coordinate pair', () => {
    expect(hasCoordinates({ lat: 5.6, lng: -0.2 })).toBe(true);
    expect(hasCoordinates({ lat: 5.6 })).toBe(false);
    expect(hasCoordinates(null)).toBe(false);
  });

  it('builds native maps handoff links', () => {
    expect(deliveryLocationUrl(5.6, -0.2)).toContain('query=5.6,-0.2');
    expect(deliveryDirectionsUrl(5.6, -0.2, 6.7, -1.6)).toContain(
      'origin=5.6,-0.2&destination=6.7,-1.6&travelmode=driving',
    );
  });
});
