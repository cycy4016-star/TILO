import { describe, expect, it } from 'vitest';
import { coverCropRect, SLOT_SIZE } from '@/lib/image';

describe('coverCropRect', () => {
  it('keeps a matching aspect untouched (1600x640 photo into banner)', () => {
    expect(coverCropRect(1600, 640, 1600, 640)).toEqual({ x: 0, y: 0, w: 1600, h: 640 });
  });

  it('center-crops a landscape photo to the wide banner slot', () => {
    const crop = coverCropRect(1600, 1200, SLOT_SIZE.banner.width, SLOT_SIZE.banner.height);
    expect(crop.w).toBe(1600);
    expect(crop.h).toBe(640);
    expect(crop.x).toBe(0);
    expect(crop.y).toBe(280);
  });

  it('center-crops a portrait phone photo to the banner without stretching', () => {
    const crop = coverCropRect(1080, 1920, SLOT_SIZE.banner.width, SLOT_SIZE.banner.height);
    expect(crop.w).toBe(1080);
    expect(crop.h).toBe(432);
    expect(crop.x).toBe(0);
    expect(crop.y).toBe(744);
    expect(crop.w / crop.h).toBeCloseTo(1600 / 640, 2);
  });

  it('crops a square upload to the 4:3 item slot', () => {
    const crop = coverCropRect(1000, 1000, SLOT_SIZE.item.width, SLOT_SIZE.item.height);
    expect(crop).toEqual({ x: 0, y: 125, w: 1000, h: 750 });
  });

  it('crops a wide upload to the square logo slot', () => {
    const crop = coverCropRect(1200, 800, SLOT_SIZE.logo.width, SLOT_SIZE.logo.height);
    expect(crop).toEqual({ x: 200, y: 0, w: 800, h: 800 });
  });

  it('keeps every slot at its documented shape', () => {
    expect(SLOT_SIZE.banner.width / SLOT_SIZE.banner.height).toBeCloseTo(2.5, 5);
    expect(SLOT_SIZE.item.width / SLOT_SIZE.item.height).toBeCloseTo(4 / 3, 5);
    expect(SLOT_SIZE.promo.width / SLOT_SIZE.promo.height).toBeCloseTo(16 / 9, 5);
    expect(SLOT_SIZE.logo.width).toBe(SLOT_SIZE.logo.height);
  });
});
