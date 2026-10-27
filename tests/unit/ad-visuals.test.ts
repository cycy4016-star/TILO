import { describe, expect, it } from 'vitest';
import { adCoverImage, formatAdPrice } from '@/lib/ad-visuals';

const NOW = new Date('2026-10-27T10:00:00.000Z');

describe('adCoverImage', () => {
  it('prefers the first gallery image over the legacy photo', () => {
    const legacy = new Uint8Array([1]);
    const gallery = new Uint8Array([2]);
    const cover = adCoverImage({
      image: legacy,
      imageMime: 'image/jpeg',
      updatedAt: NOW,
      images: [{ image: gallery, imageMime: 'image/png', updatedAt: NOW }],
    });
    expect(cover?.image).toBe(gallery);
    expect(cover?.imageMime).toBe('image/png');
  });

  it('falls back to the legacy photo for pre-gallery rows', () => {
    const legacy = new Uint8Array([1]);
    const cover = adCoverImage({
      image: legacy,
      imageMime: 'image/jpeg',
      updatedAt: NOW,
      images: [],
    });
    expect(cover?.image).toBe(legacy);
    expect(cover?.imageMime).toBe('image/jpeg');
  });

  it('returns null when neither source has a photo', () => {
    expect(adCoverImage({ image: null, imageMime: null, updatedAt: NOW, images: [] })).toBeNull();
  });
});

describe('formatAdPrice', () => {
  it('uses the GHS prefix that the generated-artwork font can render', () => {
    const price = formatAdPrice(1_680_000);
    expect(price).toBe('GHS 16,800.00');
    expect(price).not.toContain('₵');
  });

  it('renders nothing for a missing amount', () => {
    expect(formatAdPrice(null)).toBe('');
    expect(formatAdPrice(undefined)).toBe('');
  });
});
