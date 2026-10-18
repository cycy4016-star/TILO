// Link-word (slug) helpers shared by the onboarding wizard and the
// slug-check route.
import { SLUG_MAX, SLUG_PATTERN } from '@/lib/contracts/store';

export function isValidSlug(value: string): boolean {
  return value.length >= 2 && value.length <= SLUG_MAX && SLUG_PATTERN.test(value);
}

// "Ama's Boutique" -> "amas-boutique". Strips accents, drops apostrophes
// instead of turning them into dashes, collapses everything else to single
// dashes and trims the ends (including any dash cut off by the length cap).
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
}
