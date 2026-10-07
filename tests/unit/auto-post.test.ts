// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  type AutoPostCategory,
  type AutoPostItem,
  buildAutoCaption,
  pickAutoPostSubject,
} from '@/lib/auto-post';
import {
  AutoPostGenerateResult,
  AutoPostSettings,
  SocialAccountBatch,
} from '@/lib/contracts/social';

const categories: AutoPostCategory[] = [
  { id: 'cat-beads', name: 'Beads', active: true },
  { id: 'cat-art', name: 'Wall art', active: true },
];

function item(overrides: Partial<AutoPostItem> & { id: string }): AutoPostItem {
  return {
    name: `Item ${overrides.id}`,
    description: null,
    pricePesewas: 1000,
    categoryId: null,
    active: true,
    hasImage: false,
    ...overrides,
  };
}

describe('pickAutoPostSubject', () => {
  it('returns null when nothing is live', () => {
    expect(pickAutoPostSubject([], categories)).toBeNull();
    expect(pickAutoPostSubject([item({ id: 'a', active: false })], categories, () => 0)).toBeNull();
  });

  it('ignores hidden shelves but keeps their items as loose', () => {
    const hidden: AutoPostCategory[] = [{ id: 'cat-beads', name: 'Beads', active: false }];
    const subject = pickAutoPostSubject(
      [item({ id: 'a', categoryId: 'cat-beads' })],
      hidden,
      () => 0,
    );
    expect(subject?.category).toBeNull();
    expect(subject?.item.id).toBe('a');
  });

  it('prefers a shelf that can supply artwork', () => {
    const items = [
      item({ id: 'plain', categoryId: 'cat-beads', hasImage: false }),
      item({ id: 'pictured', categoryId: 'cat-art', hasImage: true }),
    ];
    // With random 0 the first group would win — the pictured preference must
    // override the draw.
    const subject = pickAutoPostSubject(items, categories, () => 0);
    expect(subject?.item.id).toBe('pictured');
    expect(subject?.category?.name).toBe('Wall art');
  });

  it('names siblings on the same shelf', () => {
    const items = [
      item({ id: 'a', name: 'Alpha', categoryId: 'cat-beads', hasImage: true }),
      item({ id: 'b', name: 'Beta', categoryId: 'cat-beads', hasImage: true }),
      item({ id: 'c', name: 'Gamma', categoryId: 'cat-beads', hasImage: true }),
    ];
    const subject = pickAutoPostSubject(items, categories, () => 0);
    expect(subject?.siblings.length).toBeGreaterThan(0);
  });
});

describe('buildAutoCaption', () => {
  it('carries identity, price, store link and tags', () => {
    const subject = {
      item: item({
        id: 'a',
        name: 'Kente Cloth',
        description: 'Handwoven in Bonwire.',
        pricePesewas: 90000,
        categoryId: 'cat-beads',
        hasImage: true,
      }),
      category: categories[0] ?? null,
      siblings: [item({ id: 'b', name: 'Bead Necklace', categoryId: 'cat-beads' })],
    };
    const caption = buildAutoCaption(
      subject,
      {
        storeName: 'Adom Fabrics',
        storeUrl: 'https://tilo.app/store/adom-fabrics',
        platform: 'INSTAGRAM',
      },
      () => 0,
    );
    expect(caption).toContain('Kente Cloth');
    expect(caption).toContain('GH₵');
    expect(caption).toContain('https://tilo.app/store/adom-fabrics');
    expect(caption).toContain('Adom Fabrics');
    expect(caption).toContain('Bead Necklace');
    expect(caption).toContain('#');
    expect(caption.length).toBeLessThanOrEqual(2200);
  });

  it('stays tag-free on WhatsApp Status', () => {
    const subject = {
      item: item({ id: 'a', name: 'Bowl' }),
      category: null,
      siblings: [],
    };
    const caption = buildAutoCaption(
      subject,
      { storeName: 'S', storeUrl: 'https://t/app', platform: 'WHATSAPP_STATUS' },
      () => 0,
    );
    expect(caption).not.toMatch(/#\w/);
  });
});

describe('auto-post contracts', () => {
  it('accepts settings and generate results', () => {
    expect(AutoPostSettings.safeParse({ days: 7, lastAt: null, nextAt: null }).success).toBe(true);
    expect(
      AutoPostGenerateResult.safeParse({
        ok: true,
        generated: 4,
        at: '2026-09-22T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('rejects duplicate platforms in one save', () => {
    const dup = SocialAccountBatch.safeParse({
      accounts: [
        { platform: 'TIKTOK', handle: '@a' },
        { platform: 'TIKTOK', handle: '@b' },
      ],
    });
    expect(dup.success).toBe(false);
  });
});
