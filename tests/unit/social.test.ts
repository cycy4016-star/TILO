// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SocialPostCreate, SocialPostRecord, SocialPostUpdate } from '@/lib/contracts/social';
import { buildSocialCaption, SOCIAL_PLATFORM_DEFS, shareUrlFor } from '@/lib/social';

const item = {
  name: 'Branded apron',
  description: 'One colour, printed on demand in Accra.',
  pricePesewas: 4550,
};

describe('social captions', () => {
  it('builds a caption with price, order link and store name', () => {
    const caption = buildSocialCaption(
      item,
      "Ama's Boutique",
      'https://tilo.app/store/amas-boutique',
      'INSTAGRAM',
    );
    expect(caption).toContain('Branded apron');
    expect(caption).toContain('GH₵');
    expect(caption).toContain('https://tilo.app/store/amas-boutique');
    expect(caption).toContain("Ama's Boutique");
  });

  it('adds platform-specific hashtags but not on WhatsApp Status', () => {
    const tiktok = buildSocialCaption(item, 'S', 'https://t/app', 'TIKTOK');
    expect(tiktok).toContain('#tiktokgh');
    const insta = buildSocialCaption(item, 'S', 'https://t/app', 'INSTAGRAM');
    expect(insta).toContain('#ghanabusiness');
    const status = buildSocialCaption(item, 'S', 'https://t/app', 'WHATSAPP_STATUS');
    expect(status).not.toMatch(/#/);
  });

  it('trims long descriptions', () => {
    const long = buildSocialCaption(
      { ...item, description: 'x'.repeat(500) },
      'S',
      'https://t/app',
      'FACEBOOK_PAGE',
    );
    expect(long.length).toBeLessThan(400);
    expect(long).toContain('…');
  });

  it('keeps the caption under the wire limit', () => {
    for (const platform of SOCIAL_PLATFORM_DEFS.map((entry) => entry.value)) {
      const caption = buildSocialCaption(
        { ...item, description: 'y'.repeat(500) },
        'A very long store name '.repeat(4),
        'https://tilo.app/store/some-long-slug',
        platform,
      );
      expect(caption.length).toBeLessThanOrEqual(2200);
    }
  });
});

describe('share targets', () => {
  it('points TikTok at the upload page and WhatsApp at a wa.me draft', () => {
    expect(shareUrlFor('TIKTOK', 'caption')).toBe('https://www.tiktok.com/tiktokstudio/upload');
    const wa = shareUrlFor('WHATSAPP_STATUS', 'hello status');
    expect(wa).toContain('https://wa.me/?text=');
    expect(wa).toContain(encodeURIComponent('hello status'));
  });

  it('exposes a sensible label + hint for every platform', () => {
    expect(SOCIAL_PLATFORM_DEFS.map((entry) => entry.value)).toContain('FACEBOOK_PAGE');
    for (const def of SOCIAL_PLATFORM_DEFS) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.hint.length).toBeGreaterThan(0);
    }
  });
});

describe('social contracts', () => {
  it('accepts a well-formed share log and rejects empty captions', () => {
    expect(
      SocialPostCreate.safeParse({
        itemId: 'item-1',
        platform: 'TIKTOK',
        caption: 'hello',
      }).success,
    ).toBe(true);
    expect(
      SocialPostCreate.safeParse({ itemId: 'item-1', platform: 'TIKTOK', caption: ' ' }).success,
    ).toBe(false);
    expect(SocialPostCreate.safeParse({ itemId: 'item-1', platform: 'LINKEDIN' }).success).toBe(
      false,
    );
  });

  it('parses a stored post record with its item name', () => {
    const record = {
      id: 'post-1',
      storeId: 'store-1',
      itemId: 'item-1',
      itemName: 'Branded apron',
      platform: 'INSTAGRAM' as const,
      status: 'SHARED' as const,
      caption: 'hello',
      externalUrl: null,
      createdAt: '2026-09-22T00:00:00.000Z',
      updatedAt: '2026-09-22T00:00:00.000Z',
    };
    expect(SocialPostRecord.safeParse(record).success).toBe(true);
    expect(SocialPostRecord.safeParse({ ...record, platform: 'X' }).success).toBe(false);
  });

  it('accepts marking posted with or without a link', () => {
    expect(SocialPostUpdate.safeParse({ status: 'PUBLISHED' }).success).toBe(true);
    expect(
      SocialPostUpdate.safeParse({
        status: 'PUBLISHED',
        externalUrl: 'https://instagram.com/p/abc',
      }).success,
    ).toBe(true);
    expect(SocialPostUpdate.safeParse({ status: 'SHARED' }).success).toBe(true);
    expect(
      SocialPostUpdate.safeParse({ status: 'PUBLISHED', externalUrl: 'not a url' }).success,
    ).toBe(false);
  });
});
