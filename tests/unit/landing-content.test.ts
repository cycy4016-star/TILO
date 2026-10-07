// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { FEATURE_ICON_MAP } from '@/components/landing/features';
import {
  billingPrice,
  FAQS,
  FEATURE_ICONS,
  FEATURES,
  FOOTER_COLUMNS,
  LANDING,
  PLANS,
  SOCIALS,
  STEPS,
  yearlySavingsPct,
} from '@/lib/landing-content';

describe('pricing toggle math', () => {
  it('bills monthly at the monthly amount', () => {
    const shop = PLANS.find((plan) => plan.id === 'shop');
    expect(shop).toBeDefined();
    if (!shop) return;
    expect(billingPrice(shop, 'monthly')).toMatchObject({ amount: 45, per: '/mo' });
  });

  it('bills yearly up front with a per-month note', () => {
    const shop = PLANS.find((plan) => plan.id === 'shop');
    expect(shop).toBeDefined();
    if (!shop) return;
    const billed = billingPrice(shop, 'yearly');
    expect(billed.amount).toBe(450);
    expect(billed.per).toBe('/yr');
    expect(billed.note).toContain('37.50');
  });

  it('computes the yearly saving vs 12x monthly', () => {
    const shop = PLANS.find((plan) => plan.id === 'shop');
    expect(shop).toBeDefined();
    if (!shop) return;
    // 1 - 450/540 = 16.7% -> 17%.
    expect(yearlySavingsPct(shop)).toBe(17);
  });

  it('treats the free plan as free forever on either cycle', () => {
    const starter = PLANS.find((plan) => plan.id === 'starter');
    expect(starter).toBeDefined();
    if (!starter) return;
    expect(yearlySavingsPct(starter)).toBeNull();
    expect(billingPrice(starter, 'monthly').note).toBe('Free forever');
    expect(billingPrice(starter, 'yearly').note).toBe('Free forever');
  });
});

describe('plan config', () => {
  it('offers three plans with exactly one highlighted', () => {
    expect(PLANS).toHaveLength(3);
    expect(PLANS.filter((plan) => plan.highlighted)).toHaveLength(1);
  });

  it('gives every plan a name, CTA, href and at least 3 features', () => {
    for (const plan of PLANS) {
      expect(plan.name.length).toBeGreaterThan(0);
      expect(plan.cta.length).toBeGreaterThan(0);
      expect(plan.href.startsWith('/')).toBe(true);
      expect(plan.features.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('landing content shape', () => {
  it('covers six features with resolvable icons', () => {
    expect(FEATURES).toHaveLength(6);
    for (const feature of FEATURES) {
      expect(FEATURE_ICONS).toContain(feature.icon);
      expect(FEATURE_ICON_MAP[feature.icon]).toBeDefined();
      expect(feature.title.length).toBeGreaterThan(0);
      expect(feature.body.length).toBeGreaterThan(0);
    }
  });

  it('walks three steps, five or more FAQs and a hero with two CTAs', () => {
    expect(STEPS).toHaveLength(3);
    expect(FAQS.length).toBeGreaterThanOrEqual(5);
    for (const faq of FAQS) {
      expect(faq.q.length).toBeGreaterThan(0);
      expect(faq.a.length).toBeGreaterThan(0);
    }
    expect(LANDING.hero.primary.href).toBe('/signup');
    expect(LANDING.hero.secondary.href.startsWith('#')).toBe(true);
    expect(LANDING.proof.stats.length).toBeGreaterThan(0);
  });

  it('links the footer in columns with internal or https hrefs', () => {
    expect(FOOTER_COLUMNS.length).toBeGreaterThanOrEqual(3);
    for (const column of FOOTER_COLUMNS) {
      for (const link of column.links) {
        expect(
          link.href.startsWith('/') ||
            link.href.startsWith('#') ||
            link.href.startsWith('https://'),
        ).toBe(true);
      }
    }
    expect(SOCIALS.length).toBeGreaterThanOrEqual(4);
  });
});
