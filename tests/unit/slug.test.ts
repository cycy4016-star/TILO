// Link-word helpers: the name→slug transform that powers the wizard's
// auto-suggest, and the shared legality check used by client + route + the
// upsert contract.
import { describe, expect, it } from 'vitest';
import { SLUG_MAX, SLUG_PATTERN } from '@/lib/contracts/store';
import { isValidSlug, slugify } from '@/lib/slug';

describe('slugify', () => {
  it('turns a name into a link word', () => {
    expect(slugify("Ama's Boutique")).toBe('amas-boutique');
  });

  it('strips accents and trims padding', () => {
    expect(slugify('  Café Déjà Vu  ')).toBe('cafe-deja-vu');
  });

  it('collapses punctuation runs into single dashes', () => {
    expect(slugify('A.B.C Ltd!!')).toBe('a-b-c-ltd');
    expect(slugify('A--B')).toBe('a-b');
    expect(slugify('---hello---')).toBe('hello');
  });

  it('caps length without leaving a trailing dash', () => {
    const result = slugify('word '.repeat(20));
    expect(result.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(result.endsWith('-')).toBe(false);
    expect(SLUG_PATTERN.test(result)).toBe(true);
  });

  it('returns an empty string for nothing usable', () => {
    expect(slugify('😀😀')).toBe('');
    expect(slugify('   ')).toBe('');
  });
});

describe('isValidSlug', () => {
  it('accepts lowercase words and dashes, min 2 chars', () => {
    expect(isValidSlug('ab')).toBe(true);
    expect(isValidSlug('amas-boutique-2')).toBe(true);
  });

  it('rejects too-short, uppercase, edge-dash and double-dash values', () => {
    expect(isValidSlug('a')).toBe(false);
    expect(isValidSlug('Ab')).toBe(false);
    expect(isValidSlug('-ab')).toBe(false);
    expect(isValidSlug('ab-')).toBe(false);
    expect(isValidSlug('ab--cd')).toBe(false);
  });

  it('rejects values past the length cap', () => {
    expect(isValidSlug('a'.repeat(SLUG_MAX))).toBe(true);
    expect(isValidSlug('a'.repeat(SLUG_MAX + 1))).toBe(false);
  });
});
