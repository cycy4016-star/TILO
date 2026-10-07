// The auto-posting brain: choose what the next scheduled batch is about and
// write its caption. Pure and client-safe — the API route runs it to create the
// drafts, and vitest exercises it without a database.
//
// Two rules shape it:
//   1. the subject is drawn at random across the owner's shelves (so a shop
//      with "Beads" and "Wall art" doesn't keep advertising the same thing),
//   2. the artwork is drawn from the photo pool, preferring a shelf that can
//      actually supply an image so a generated post always has one.
import { formatGhs } from '@/lib/contracts/order';
import type { SocialPlatformValue } from '@/lib/contracts/social';
import { hashtagsFor } from '@/lib/social';

export type AutoPostItem = {
  id: string;
  name: string;
  description: string | null;
  pricePesewas: number;
  categoryId: string | null;
  active: boolean;
  hasImage: boolean;
};

export type AutoPostCategory = { id: string; name: string; active: boolean };

export type AutoPostSubject = {
  item: AutoPostItem;
  // Null for an uncategorised item (or a shelf row that no longer resolves).
  category: AutoPostCategory | null;
  // Up to two other live items on the same shelf, named in the caption so the
  // post sells the category, not just one product.
  siblings: AutoPostItem[];
};

const DESCRIPTION_LIMIT = 220;
const SIBLING_LIMIT = 2;

function pickOne<T>(list: T[], random: () => number): T {
  const index = Math.min(list.length - 1, Math.floor(random() * list.length));
  const entry = list[index];
  // `random()` can legally return 1; every caller below guards against an
  // undefined element rather than trusting the arithmetic.
  if (entry === undefined) throw new Error('pickOne called with an empty list');
  return entry;
}

function clamp(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function joinNames(items: AutoPostItem[]): string {
  const names = items.slice(0, SIBLING_LIMIT).map((item) => item.name);
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Choose the item the next batch talks about.
 *
 * Hidden shelves and inactive items never make the cut — same rule the
 * storefront uses for browsing and ordering. Returns null when the catalogue
 * has nothing live to post about.
 */
export function pickAutoPostSubject(
  items: AutoPostItem[],
  categories: AutoPostCategory[],
  random: () => number = Math.random,
): AutoPostSubject | null {
  const live = items.filter((item) => item.active);
  if (live.length === 0) return null;

  const shelves = new Map<string, AutoPostCategory>();
  for (const category of categories) {
    if (category.active) shelves.set(category.id, category);
  }

  const groups = new Map<string | null, AutoPostItem[]>();
  for (const item of live) {
    // An item filed under a shelf the owner hid is treated as loose rather
    // than dropped: it is still sellable, it just has no heading on the page.
    const key = item.categoryId && shelves.has(item.categoryId) ? item.categoryId : null;
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  const shaped = [...groups.entries()].map(([categoryId, groupItems]) => ({
    categoryId,
    items: groupItems,
    category: categoryId ? (shelves.get(categoryId) ?? null) : null,
  }));
  if (shaped.length === 0) return null;

  // Prefer a group that can supply artwork; fall back to any group so a photo-
  // free catalogue still gets scheduled posts.
  const pictured = shaped.filter((group) => group.items.some((item) => item.hasImage));
  const group = pickOne(pictured.length > 0 ? pictured : shaped, random);
  const candidates = group.items.filter((item) => item.hasImage);
  const item = pickOne(candidates.length > 0 ? candidates : group.items, random);

  return {
    item,
    category: group.category,
    siblings: group.items.filter((other) => other.id !== item.id),
  };
}

// Opening line — varied per run so a fortnightly schedule doesn't repeat itself.
function hookLines(storeName: string, shelf: string | null): string[] {
  if (shelf) {
    return [
      `Straight from the ${shelf} shelf.`,
      `${shelf} pick of the week.`,
      `This week in ${shelf}.`,
      `Fresh on the ${shelf} shelf at ${storeName}.`,
    ];
  }
  return [
    `Fresh on the shelf at ${storeName}.`,
    `New in at ${storeName}.`,
    `Worth a closer look at ${storeName}.`,
    `Straight from the catalogue at ${storeName}.`,
  ];
}

/**
 * The whole caption: hook, the item's identity (name, price, description),
 * its category plus siblings, the shop link, then the platform's tags.
 * Stays well inside the 2200-char contract cap and the 320-char sanity the
 * manual builder already holds itself to on the short end.
 */
export function buildAutoCaption(
  subject: AutoPostSubject,
  context: { storeName: string; storeUrl: string; platform: SocialPlatformValue },
  random: () => number = Math.random,
): string {
  const shelf = subject.category?.name ?? null;
  const description = subject.item.description?.trim();
  const siblings = subject.siblings.filter((sibling) => sibling.active);

  const lines = [
    pickOne(hookLines(context.storeName, shelf), random),
    '',
    subject.item.name,
    formatGhs(subject.item.pricePesewas),
    description ? clamp(description, DESCRIPTION_LIMIT) : null,
    '',
    siblings.length > 0
      ? `Also ${shelf ? `on the ${shelf} shelf` : 'on the shelf'}: ${joinNames(siblings)}.`
      : shelf
        ? `See the whole ${shelf} shelf at ${context.storeUrl}.`
        : null,
    `Order at ${context.storeUrl} — ${context.storeName}`,
  ].filter((line): line is string => line !== null && line.length > 0);

  const tags = hashtagsFor(context.platform);
  if (tags.length > 0) lines.push(tags.join(' '));
  return lines.join('\n');
}
