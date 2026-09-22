// The social publishing kit: platform metadata + caption builder. Pure and
// client-safe so the manager island and the API agree on what a post looks
// like. This is the "creative kit" MVP — the owner taps Share, we copy the
// caption and open the platform's composer; posting stays manual.
import { formatGhs } from '@/lib/contracts/order';
import type { SocialPlatformValue } from '@/lib/contracts/social';

export interface SocialPlatformDef {
  value: SocialPlatformValue;
  label: string;
  hint: string;
  // Where "Share" sends the owner. Null platforms are clipboard-only (the
  // composer has no deep link that accepts a caption).
  baseUrl: string | null;
}

export const SOCIAL_PLATFORM_DEFS: SocialPlatformDef[] = [
  {
    value: 'TIKTOK',
    label: 'TikTok',
    hint: 'Copies the caption, then opens TikTok for you to upload.',
    baseUrl: 'https://www.tiktok.com/tiktokstudio/upload',
  },
  {
    value: 'INSTAGRAM',
    label: 'Instagram',
    hint: 'Copies the caption, then opens Instagram for your post.',
    baseUrl: 'https://www.instagram.com/',
  },
  {
    value: 'FACEBOOK_PAGE',
    label: 'Facebook Page',
    hint: 'Copies the caption, then opens Facebook to post on your page.',
    baseUrl: 'https://www.facebook.com/',
  },
  {
    value: 'WHATSAPP_STATUS',
    label: 'WhatsApp Status',
    hint: 'Opens WhatsApp with the caption ready — paste it into your Status.',
    baseUrl: null,
  },
];

const HASHTAGS: Record<SocialPlatformValue, string[]> = {
  TIKTOK: ['#smallbusiness', '#tiktokgh', '#shoplocal'],
  INSTAGRAM: ['#smallbusiness', '#ghanabusiness', '#shoplocal'],
  FACEBOOK_PAGE: ['#SmallBusiness', '#ShopLocal'],
  WHATSAPP_STATUS: [],
};

export interface PostableItem {
  name: string;
  description: string | null;
  pricePesewas: number;
}

const DESCRIPTION_LIMIT = 220;

export function buildSocialCaption(
  item: PostableItem,
  storeName: string,
  storeUrl: string,
  platform: SocialPlatformValue,
): string {
  const description = item.description?.trim();
  const lines = [
    item.name,
    formatGhs(item.pricePesewas),
    description
      ? description.length > DESCRIPTION_LIMIT
        ? `${description.slice(0, DESCRIPTION_LIMIT)}…`
        : description
      : null,
    `Order at ${storeUrl} — ${storeName}`,
  ].filter((line): line is string => line !== null && line.length > 0);

  const tags = HASHTAGS[platform];
  if (tags.length > 0) lines.push(tags.join(' '));
  return lines.join('\n');
}

// Where "Share" sends the owner, given the caption that goes in the composer.
// WhatsApp is the only target that can carry the text in the URL itself; the
// rest open their composer with the caption already copied to the clipboard.
export function shareUrlFor(platform: SocialPlatformValue, caption: string): string | null {
  if (platform === 'WHATSAPP_STATUS') {
    const short = caption.slice(0, 1200);
    return `https://wa.me/?text=${encodeURIComponent(short)}`;
  }
  const def = SOCIAL_PLATFORM_DEFS.find((entry) => entry.value === platform);
  return def?.baseUrl ?? null;
}
