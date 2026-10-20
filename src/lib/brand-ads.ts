// The company's own ad campaign — the copy behind the creatives that live in
// scripts/ads/template.html and are rendered in-app by the /api/brand-ads
// routes. One source of truth so the repo generator, the press kit page and
// the rendered artwork never drift apart.
//
// The promise is deliberately the one the product can keep: Tilza WRITES the ad
// (image + caption) and PREPARES it for each channel. It does not publish on
// the merchant's behalf — there is no publishing queue (see src/lib/ads.ts), so
// nothing here may claim that ads are auto-posted.
import { TRIAL_DAYS } from '@/lib/trial';

export type BrandAdFormat = 'square' | 'story';

export type BrandAdKey = 'brand' | 'whatsapp' | 'offer' | 'adstudio' | 'story';

export type BrandAd = {
  key: BrandAdKey;
  /** Name shown on the press kit page. */
  label: string;
  format: BrandAdFormat;
  width: number;
  height: number;
  fileName: string;
  eyebrow: string;
  /** One entry per rendered line. */
  headline: string[];
  /** The last line is underlined in the brand colour. */
  body: string;
  cta: string;
  fine: string;
  /** Channels this creative names. */
  channels: string[];
  /** The pill line at the bottom of the creative. */
  note: string;
  /** Caption to paste with the image. */
  caption: string;
  hashtags: string[];
  /** Product photo used in the creative, from public/samples. */
  photo: string;
  photoCaption: string;
};

export const BRAND_AD_CHANNELS = [
  'WhatsApp Status',
  'TikTok',
  'Facebook',
  'Instagram',
  'Telegram',
  'X',
] as const;

/**
 * What actually happens when a merchant taps a channel. Kept beside the
 * campaign so the press kit can state it plainly — the ads promise one tap,
 * not an unattended publisher.
 */
export const BRAND_AD_POSTING_FLOW: { channel: string; what: string }[] = [
  {
    channel: 'WhatsApp',
    what: 'Opens with your caption and shop link ready — the ad image is saved for you to attach to a Status.',
  },
  {
    channel: 'Telegram and X',
    what: 'Open with your caption and shop link ready.',
  },
  {
    channel: 'TikTok, Facebook and Instagram',
    what: 'The ad image is saved and the caption copied — paste it in and post.',
  },
];

export const BRAND_AD_TRUTH =
  'Tilza writes the ad image and the caption for every product in your shop and hands them to the channel you pick. You make the final post — nothing is published from your account without you.';

const CHANNEL_LINE = 'WhatsApp Status, TikTok, Facebook or Instagram';

export const BRAND_ADS: BrandAd[] = [
  {
    key: 'brand',
    label: 'Brand — one link, open for orders',
    format: 'square',
    width: 1080,
    height: 1080,
    fileName: 'tilza-brand-square-1080.png',
    eyebrow: 'Online shops for small businesses',
    headline: ['Your shop.', 'One link.', 'Open for orders.'],
    body: 'Add your products, set your prices and share one link. Customers browse and fill a basket — every order arrives on WhatsApp.',
    cta: `Start free for ${TRIAL_DAYS} days`,
    fine: 'No card needed · Set up in minutes',
    channels: ['WhatsApp Status', 'TikTok', 'Facebook'],
    note: 'Ready-to-post ads included',
    caption:
      'Your shop deserves a link that sells. Tilza turns your products into a shop page with photos, prices and a basket — and every order lands on your WhatsApp.',
    hashtags: ['#Tilza', '#OnlineShop', '#SmallBusinessGhana', '#MadeInGhana'],
    photo: 'phone-nova.jpg',
    photoCaption: 'Nova X5, 128GB · GHS 2,450.00',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp — give your chat a link',
    format: 'square',
    width: 1080,
    height: 1080,
    fileName: 'tilza-whatsapp-square-1080.png',
    eyebrow: 'For WhatsApp-first shops',
    headline: ['Your WhatsApp', 'is already a shop.', 'Give it a link.'],
    body: 'Let customers browse your products, fill a basket and send the order straight to your WhatsApp — itemised and totalled.',
    cta: `Start free for ${TRIAL_DAYS} days`,
    fine: 'No card needed · Set up in minutes',
    channels: ['WhatsApp Status', 'TikTok', 'Facebook', 'Instagram'],
    note: 'We make the ads · you just post',
    caption:
      'Your WhatsApp is already a shop. Give it a link: browse, basket, order — itemised and totalled, straight to your chat.',
    hashtags: ['#Tilza', '#WhatsAppBusiness', '#SellOnWhatsApp', '#MadeInGhana'],
    photo: 'backpack.jpg',
    photoCaption: 'Everyday backpack · GHS 320.00',
  },
  {
    key: 'offer',
    label: 'Offer — 30 days free',
    format: 'square',
    width: 1080,
    height: 1080,
    fileName: 'tilza-offer-square-1080.png',
    eyebrow: 'Free trial',
    headline: [`${TRIAL_DAYS} days free.`, 'No card.', 'No website.'],
    body: 'Put your products, prices and shop link online in minutes. Orders arrive in your dashboard and on WhatsApp.',
    cta: 'Open your shop',
    fine: 'No card needed · Cancel anytime',
    channels: ['WhatsApp Status', 'TikTok', 'Facebook'],
    note: 'Ads included · ready to post',
    caption: `${TRIAL_DAYS} days free. No card, no website, no setup fee — just your products online and a ready-to-post ad for each one.`,
    hashtags: ['#Tilza', '#TryTilza', '#OnlineStore', '#SmallBusinessGhana'],
    photo: 'headphones.jpg',
    photoCaption: 'Bass headphones · GHS 550.00',
  },
  {
    key: 'adstudio',
    label: 'Ad Studio — we make the ads',
    format: 'square',
    width: 1080,
    height: 1080,
    fileName: 'tilza-adstudio-square-1080.png',
    eyebrow: 'Tilza Ad Studio',
    headline: ['We make', 'the ads.', 'You sell more.'],
    body: `Every product in your shop gets a ready-to-post ad — the image and the caption, written for you. One tap and it’s ready for ${CHANNEL_LINE}.`,
    cta: `Start free for ${TRIAL_DAYS} days`,
    fine: 'No card needed · Set up in minutes',
    channels: ['WhatsApp Status', 'TikTok', 'Facebook', 'Instagram'],
    note: 'A new ad every day',
    caption:
      'We make the ads. Every product in your shop gets a ready-to-post ad — image and caption written for you — and one tap from there to WhatsApp Status, TikTok, Facebook or Instagram.',
    hashtags: ['#Tilza', '#AdStudio', '#MadeInGhana', '#SellMore'],
    photo: 'headphones.jpg',
    photoCaption: 'Bass headphones · GHS 550.00',
  },
  {
    key: 'story',
    label: 'Story — we make the ads',
    format: 'story',
    width: 1080,
    height: 1920,
    fileName: 'tilza-brand-story-1080x1920.png',
    eyebrow: 'Tilza Ad Studio',
    headline: ['We make', 'the ads.', 'You sell more.'],
    body: `Every product in your shop gets a ready-to-post ad — the image and the caption, written for you. One tap and it’s ready for ${CHANNEL_LINE}.`,
    cta: `Start free for ${TRIAL_DAYS} days`,
    fine: 'No card needed · Set up in minutes',
    channels: ['WhatsApp Status', 'TikTok', 'Facebook', 'Instagram'],
    note: 'Ads made daily',
    caption:
      'We make the ads. You sell more. Every product gets a ready-to-post ad, written for you and ready for WhatsApp Status, TikTok, Facebook or Instagram.',
    hashtags: ['#Tilza', '#AdStudio', '#OnlineShop', '#SmallBusinessGhana'],
    photo: 'backpack.jpg',
    photoCaption: 'Everyday backpack · GHS 320.00',
  },
];

export function brandAd(key: string | null | undefined): BrandAd | undefined {
  return BRAND_ADS.find((ad) => ad.key === key);
}
