// Daily ad engine. Pure, client-safe and deterministic: given a shop's live
// listings, it writes one ready-to-post ad per listing — a headline, a dynamic
// caption and hashtags — and rotates the "angle" once per UTC day. Nothing is
// persisted, so "every 24 hours" needs no scheduler: the same input produces a
// fresh set when the day key flips, and the exact same set within a day.
//
// The artwork is rendered separately by /api/public/store/items/[itemId]/ad,
// which reads the listing's own photo and this shop's brand colour. Copy now;
// LLM-written captions and video ads are a deliberate later layer.
import { formatGhs } from '@/lib/contracts/order';
import { waMessageLink } from '@/lib/phone';
import { itemDiscountPercent, promoHeadline, promosForItem } from '@/lib/promotions';
import { itemOrderWhatsApp } from '@/lib/whatsapp-templates';

/** Stock at or below this reads as "moving fast" in the caption. */
const LOW_STOCK = 5;

// --- Formats ---------------------------------------------------------------

export type AdFormat = {
  key: 'square' | 'story' | 'wide';
  label: string;
  hint: string;
  width: number;
  height: number;
};

export const AD_FORMATS: AdFormat[] = [
  { key: 'square', label: 'Square', hint: 'Feed · Instagram, Facebook', width: 1080, height: 1080 },
  {
    key: 'story',
    label: 'Story',
    hint: 'Status · WhatsApp, IG, TikTok',
    width: 1080,
    height: 1920,
  },
  { key: 'wide', label: 'Wide', hint: 'Link card · X, WhatsApp', width: 1200, height: 630 },
];

const DEFAULT_FORMAT: AdFormat = {
  key: 'square',
  label: 'Square',
  hint: 'Feed · Instagram, Facebook',
  width: 1080,
  height: 1080,
};

/** Coerce a query value to a known format, defaulting to square. */
export function adFormat(key: string | null | undefined): AdFormat {
  return AD_FORMATS.find((format) => format.key === key) ?? DEFAULT_FORMAT;
}

/** Same-origin path for a listing's generated ad image in one format. */
export function adImagePath(itemId: string, format: AdFormat['key']): string {
  return `/api/public/store/items/${itemId}/ad?format=${format}`;
}

// --- Multi-product ad ------------------------------------------------------

/** How many listings a multi-product ad shows, per format. Wide is a short
 *  link card, so it carries a single row; story has the height for two. */
export const CAROUSEL_MAX: Record<AdFormat['key'], number> = {
  square: 4,
  story: 6,
  wide: 3,
};

/** Same-origin path for a multi-product ad showing several listings at once. */
export function carouselAdPath(slug: string, itemIds: string[], format: AdFormat['key']): string {
  const ids = itemIds.slice(0, CAROUSEL_MAX[format]);
  return `/api/public/store/${slug}/carousel?ids=${encodeURIComponent(ids.join(','))}&format=${format}`;
}

// --- Live call to action ---------------------------------------------------

export type AdOrderActionInput = {
  storeName: string;
  storeSlug: string;
  itemId: string;
  itemName: string;
  pricePesewas: number;
  compareAtPricePesewas: number | null;
  discountPercent: number | null;
  contactPhone: string | null;
  /** Absolute site origin, e.g. "https://tilza.org" — used for the fallback. */
  origin: string;
};

export type AdOrderAction = {
  href: string;
  label: string;
  /** True when `href` opens a WhatsApp chat (vs the shop-link fallback). */
  whatsapp: boolean;
};

/**
 * Where an ad's call to action points: the shop's WhatsApp chat with a
 * prefilled order, or the shop link when there is no usable number. The Ad
 * Studio renders this as a real, clickable button over the artwork, so the
 * drawn-in pill can stay a plain graphic in the published image.
 */
export function adOrderAction(input: AdOrderActionInput): AdOrderAction {
  const priceLabel =
    input.discountPercent != null && input.compareAtPricePesewas != null
      ? `${formatGhs(input.pricePesewas)}, was ${formatGhs(input.compareAtPricePesewas)} (${input.discountPercent}% off)`
      : formatGhs(input.pricePesewas);
  const chat = input.contactPhone
    ? waMessageLink(
        input.contactPhone,
        itemOrderWhatsApp({
          storeName: input.storeName,
          itemName: input.itemName,
          priceLabel,
          quantity: 1,
        }),
      )
    : null;
  return {
    href: chat ?? `${input.origin}/store/${input.storeSlug}#${input.itemId}`,
    label: chat ? 'Order on WhatsApp' : 'Order from our shop',
    whatsapp: chat != null,
  };
}

// --- Shop-level call to action --------------------------------------------

export type StoreOrderActionInput = {
  storeName: string;
  storeSlug: string;
  contactPhone: string | null;
  /** Absolute site origin, e.g. "https://tilza.org" — used for the fallback. */
  origin: string;
};

/**
 * The call to action for an ad that covers the whole shop (a multi-product ad
 * or a "post everything" batch) rather than one listing: the shop's WhatsApp
 * chat, or the shop link when there is no usable number.
 */
export function storeOrderAction(input: StoreOrderActionInput): AdOrderAction {
  const chat = input.contactPhone
    ? waMessageLink(input.contactPhone, `Hi ${input.storeName}! I'd like to order from your shop.`)
    : null;
  return {
    href: chat ?? `${input.origin}/store/${input.storeSlug}`,
    label: chat ? 'Order on WhatsApp' : 'Visit our shop',
    whatsapp: chat != null,
  };
}

// --- Posting channels ------------------------------------------------------

export type AdChannel = 'whatsapp' | 'facebook' | 'instagram' | 'tiktok' | 'x' | 'telegram';

export type AdChannelInfo = {
  key: AdChannel;
  label: string;
  /** `compose` opens a web composer with the caption; `save` has no web
   *  poster, so the image is saved and the caption copied for the app. */
  mode: 'compose' | 'save';
};

export const AD_CHANNELS: AdChannelInfo[] = [
  { key: 'whatsapp', label: 'WhatsApp', mode: 'compose' },
  { key: 'facebook', label: 'Facebook', mode: 'compose' },
  { key: 'instagram', label: 'Instagram', mode: 'save' },
  { key: 'tiktok', label: 'TikTok', mode: 'save' },
  { key: 'x', label: 'X', mode: 'compose' },
  { key: 'telegram', label: 'Telegram', mode: 'compose' },
];

export type AdPostPlan = {
  /** Composer or platform to open, or null when there is nothing to open. */
  href: string | null;
  /** Copy the caption to the clipboard (for channels that can't carry text). */
  copyCaption: boolean;
  /** Download the generated ad image (image-first channels). */
  saveImage: boolean;
  /** What to tell the owner after the tap. */
  note: string;
};

/**
 * What tapping a channel should do. `caption` already carries the shop link,
 * so compose channels hand the whole thing over as text.
 */
export function adPostPlan(channel: AdChannel, caption: string, url: string): AdPostPlan {
  switch (channel) {
    case 'whatsapp':
      return {
        href: `https://wa.me/?text=${encodeURIComponent(caption)}`,
        copyCaption: false,
        saveImage: false,
        note: 'WhatsApp opened with your ad. Attach the saved image to include the photo.',
      };
    case 'telegram':
      return {
        href: `https://t.me/share/url?text=${encodeURIComponent(caption)}`,
        copyCaption: false,
        saveImage: false,
        note: 'Telegram opened with your ad.',
      };
    case 'x':
      return {
        href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}`,
        copyCaption: false,
        saveImage: false,
        note: 'X opened with your ad.',
      };
    case 'facebook':
      return {
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        copyCaption: true,
        saveImage: false,
        note: 'Facebook opened with the link — the caption is copied, paste it into the post.',
      };
    case 'instagram':
      return {
        href: 'https://www.instagram.com/',
        copyCaption: true,
        saveImage: true,
        note: 'Image saved and caption copied — post it from the Instagram app.',
      };
    case 'tiktok':
      return {
        href: 'https://www.tiktok.com/upload',
        copyCaption: true,
        saveImage: true,
        note: 'Image saved and caption copied — finish the post in TikTok.',
      };
  }
}

// --- Campaign caption (shared by batch + multi-product posts) --------------

export type AdCampaignItem = {
  itemId: string;
  headline: string;
  pricePesewas: number;
  compareAtPricePesewas: number | null;
  discountPercent: number | null;
  hashtags: string[];
};

export type AdCampaignInput = {
  storeName: string;
  storeSlug: string;
  /** Absolute site origin, e.g. "https://tilza.org" — used to build item links. */
  origin: string;
  contactPhone: string | null;
  /** Optional heading ("Today's picks"); falls back to a generic one. */
  title?: string;
  items: AdCampaignItem[];
};

/**
 * One caption covering several listings — used for the multi-product ad and for
 * "post everything" batches. Each listing gets a numbered line with its price
 * and a deep link, followed by a single shop-wide call to action and the
 * deduped hashtags. Mirrors `buildDailyAds`' caption shape so a batch reads
 * like the individual ads it replaces.
 */
export function buildCampaignCaption(input: AdCampaignInput): string {
  const title = input.title?.trim() || `${input.storeName} — today's picks`;
  const lines: string[] = [title, ''];
  input.items.forEach((item, index) => {
    const price =
      item.discountPercent != null && item.compareAtPricePesewas != null
        ? `${formatGhs(item.pricePesewas)} (was ${formatGhs(item.compareAtPricePesewas)}, ${item.discountPercent}% off)`
        : formatGhs(item.pricePesewas);
    lines.push(`${index + 1}. ${item.headline}`);
    lines.push(`${price} — ${input.origin}/store/${input.storeSlug}#${item.itemId}`);
    lines.push('');
  });

  const chat = input.contactPhone
    ? waMessageLink(input.contactPhone, `Hi ${input.storeName}! I'd like to order from your shop.`)
    : null;
  lines.push(
    chat
      ? `Order on WhatsApp: ${chat}`
      : `Shop the full collection: ${input.origin}/store/${input.storeSlug}`,
  );

  const tags = [...new Set(input.items.flatMap((item) => item.hashtags))].slice(0, 8);
  if (tags.length > 0) {
    lines.push('');
    lines.push(tags.join(' '));
  }
  return lines.join('\n').trim();
}

// --- Deterministic daily rotation -----------------------------------------

/** UTC day key ("2026-10-14") — the rotation seed for the ad feed. */
export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Tiny FNV-1a hash so a shop+day+item always lands on the same variant. */
export function hashSeed(parts: (string | number)[]): number {
  const text = parts.join('|');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// --- Caption building ------------------------------------------------------

export type AdItemInput = {
  id: string;
  kind: 'PRODUCT' | 'SERVICE';
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  pricePesewas: number;
  compareAtPricePesewas: number | null;
  stock: number | null;
  hasImage: boolean;
};

export type AdPromoInput = {
  name: string;
  code: string | null;
  kind: 'PERCENT' | 'FIXED';
  value: number;
  minSubtotalPesewas: number | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  itemIds: string[];
  categoryIds: string[];
};

type AdCaptionContext = {
  storeName: string;
  itemName: string;
  kind: 'PRODUCT' | 'SERVICE';
  description: string | null;
  categoryName: string | null;
  pricePesewas: number;
  compareAtPricePesewas: number | null;
  discountPercent: number | null;
  stock: number | null;
  promo: { name: string; code: string | null; kind: 'PERCENT' | 'FIXED'; value: number } | null;
  itemUrl: string;
};

type AdAngle = {
  key: string;
  label: string;
  available: (context: AdCaptionContext) => boolean;
  headline: (context: AdCaptionContext) => string;
};

const DEFAULT_ANGLE: AdAngle = {
  key: 'spotlight',
  label: 'Spotlight',
  available: () => true,
  headline: (context) => `Spotlight on ${context.itemName}`,
};

const AD_ANGLES: AdAngle[] = [
  {
    key: 'new',
    label: 'New arrival',
    available: () => true,
    headline: (context) => `New at ${context.storeName}: ${context.itemName}`,
  },
  {
    key: 'pick',
    label: 'Pick of the day',
    available: () => true,
    headline: (context) => `${context.storeName} pick of the day: ${context.itemName}`,
  },
  {
    key: 'local',
    label: 'Shop local',
    available: () => true,
    headline: (context) => `From ${context.storeName}: ${context.itemName}`,
  },
  {
    key: 'deal',
    label: 'Deal',
    available: (context) => context.discountPercent != null,
    headline: (context) => `${context.discountPercent ?? 0}% off ${context.itemName}`,
  },
  {
    key: 'promo',
    label: 'On sale',
    available: (context) => context.promo != null,
    headline: (context) => `${context.promo?.name ?? 'Sale'}: ${context.itemName}`,
  },
  {
    key: 'service',
    label: 'Book now',
    available: (context) => context.kind === 'SERVICE',
    headline: (context) => `Book ${context.itemName} today`,
  },
];

function firstSentence(text: string): string {
  const normalised = text.trim().replace(/\s+/g, ' ');
  const match = normalised.match(/^[^.!?]*[.!?]/);
  const sentence = (match ? match[0] : normalised).trim();
  if (sentence.length <= 140) return sentence;
  return `${sentence.slice(0, 137).trimEnd()}...`;
}

function tagify(value: string | null | undefined, maxWords: number): string | null {
  if (!value) return null;
  const words = value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords);
  if (words.length === 0) return null;
  const joined = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  return `#${joined}`;
}

function buildHashtags(context: AdCaptionContext): string[] {
  const candidates = [
    tagify(context.itemName, 3),
    tagify(context.categoryName, 2),
    tagify(context.storeName, 2),
    '#ShopLocal',
    '#SupportSmallBusiness',
  ];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of candidates) {
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      tags.push(tag);
    }
  }
  return tags.slice(0, 6);
}

function chooseAngle(context: AdCaptionContext, seed: number): AdAngle {
  const pool = AD_ANGLES.filter((angle) => angle.available(context));
  if (pool.length === 0) return DEFAULT_ANGLE;
  return pool[seed % pool.length] ?? DEFAULT_ANGLE;
}

function buildBody(context: AdCaptionContext): string[] {
  const lines: string[] = [];
  if (context.description?.trim()) {
    lines.push(firstSentence(context.description));
  } else if (context.kind === 'SERVICE') {
    lines.push(`${context.itemName} by ${context.storeName}.`);
  } else {
    lines.push(
      context.categoryName
        ? `Quality ${context.categoryName.toLowerCase()} from ${context.storeName}.`
        : `Quality pick from ${context.storeName}.`,
    );
  }

  if (context.stock != null && context.stock > 0 && context.stock <= LOW_STOCK) {
    lines.push(`Only ${context.stock} left.`);
  }

  if (context.discountPercent != null && context.compareAtPricePesewas != null) {
    lines.push(
      `Now ${formatGhs(context.pricePesewas)} (was ${formatGhs(
        context.compareAtPricePesewas,
      )}) — ${context.discountPercent}% off.`,
    );
  } else {
    lines.push(`Price: ${formatGhs(context.pricePesewas)}.`);
  }

  if (context.promo) {
    const headline = promoHeadline(context.promo);
    lines.push(
      context.promo.code
        ? `${context.promo.name} — ${headline}, code ${context.promo.code}.`
        : `${context.promo.name} — ${headline} right now.`,
    );
  }

  lines.push(
    context.kind === 'SERVICE' ? 'Book by WhatsApp or DM.' : 'Tap the link to order on WhatsApp.',
  );
  return lines;
}

export type AdCaption = {
  angle: string;
  headline: string;
  caption: string;
  hashtags: string[];
};

/** Build the headline + caption + hashtags for one listing, rotated by seed. */
export function buildAdCaption(context: AdCaptionContext, seed: number): AdCaption {
  const angle = chooseAngle(context, seed);
  const headline = angle.headline(context);
  const hashtags = buildHashtags(context);
  const caption = [
    headline,
    '',
    ...buildBody(context),
    '',
    context.itemUrl,
    '',
    hashtags.join(' '),
  ].join('\n');
  return { angle: angle.label, headline, caption, hashtags };
}

/** The caption context a listing turns into, with its live promo resolved. */
export function contextForItem(input: {
  storeName: string;
  storeUrl: string;
  item: AdItemInput;
  promotions: AdPromoInput[];
  now: Date;
}): AdCaptionContext {
  const live = promosForItem(input.promotions, input.item, input.now);
  const promo = live[0]
    ? {
        name: live[0].name,
        code: live[0].code ?? null,
        kind: live[0].kind,
        value: live[0].value,
      }
    : null;
  return {
    storeName: input.storeName,
    itemName: input.item.name,
    kind: input.item.kind,
    description: input.item.description,
    categoryName: input.item.categoryName,
    pricePesewas: input.item.pricePesewas,
    compareAtPricePesewas: input.item.compareAtPricePesewas,
    discountPercent: itemDiscountPercent(input.item),
    stock: input.item.stock,
    promo,
    itemUrl: `${input.storeUrl}#${input.item.id}`,
  };
}

/**
 * Today's ad feed: one draft per listing, each with a day-stable angle and
 * caption. `date` fixes the rotation (tests pass a fixed day).
 */
export function buildDailyAds(input: {
  storeName: string;
  storeSlug: string;
  storeTagline: string | null;
  storeUrl: string;
  items: AdItemInput[];
  promotions: AdPromoInput[];
  date?: Date;
}): {
  generatedAt: string;
  dayKey: string;
  storeName: string;
  storeSlug: string;
  storeTagline: string | null;
  ads: {
    itemId: string;
    kind: 'PRODUCT' | 'SERVICE';
    itemName: string;
    categoryName: string | null;
    pricePesewas: number;
    compareAtPricePesewas: number | null;
    discountPercent: number | null;
    hasImage: boolean;
    stock: number | null;
    angle: string;
    headline: string;
    caption: string;
    hashtags: string[];
  }[];
} {
  const date = input.date ?? new Date();
  const key = dayKey(date);
  const ads = input.items.map((item) => {
    const context = contextForItem({
      storeName: input.storeName,
      storeUrl: input.storeUrl,
      item,
      promotions: input.promotions,
      now: date,
    });
    const seed = hashSeed([input.storeSlug, key, item.id]);
    const copy = buildAdCaption(context, seed);
    return {
      itemId: item.id,
      kind: item.kind,
      itemName: item.name,
      categoryName: item.categoryName,
      pricePesewas: item.pricePesewas,
      compareAtPricePesewas: item.compareAtPricePesewas,
      discountPercent: context.discountPercent,
      hasImage: item.hasImage,
      stock: item.stock,
      angle: copy.angle,
      headline: copy.headline,
      caption: copy.caption,
      hashtags: copy.hashtags,
    };
  });
  return {
    generatedAt: date.toISOString(),
    dayKey: key,
    storeName: input.storeName,
    storeSlug: input.storeSlug,
    storeTagline: input.storeTagline,
    ads,
  };
}
