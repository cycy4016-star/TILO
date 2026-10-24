// Landing page content — every word on the marketing home lives here, typed,
// so copy, plans, FAQs and features can be edited without touching components.
//
// PRICES ARE PLACEHOLDERS: the cedi amounts below are stand-ins. Change them
// here and the pricing section, toggle math and tests follow automatically.
import { TRIAL_DAYS } from '@/lib/trial';

export const LANDING = {
  hero: {
    eyebrow: 'Online shops for small businesses',
    titleA: 'Your shop. One link.',
    titleAccent: 'Open for orders.',
    sub: 'Add your products, set your prices and share one link. Customers browse and fill a basket — every order arrives in your dashboard and on WhatsApp.',
    primary: { label: `Start free for ${TRIAL_DAYS} days`, href: '/signup' },
    secondary: { label: 'See sample shops', href: '#showcase' },
    reassurance: 'No card needed · Set up in minutes · Cancel anytime',
  },
  proof: {
    line: `Start selling free for ${TRIAL_DAYS} days — no card needed`,
    // Honest stats only: no shop/order counts until they are real.
    stats: [
      { value: TRIAL_DAYS, suffix: ' days', label: 'free, then a small monthly plan' },
      { value: 1, suffix: '', label: 'link for your whole shop' },
      { value: 2, suffix: ' min', label: 'to publish a product' },
    ] as { value: number; suffix: string; label: string; comma?: boolean }[],
  },
} as const;

export const FEATURE_ICONS = ['boxes', 'link', 'tag', 'palette', 'chat', 'qr'] as const;
export type FeatureIcon = (typeof FEATURE_ICONS)[number];

export type Feature = {
  icon: FeatureIcon;
  title: string;
  body: string;
  span: 1 | 2;
};

export const FEATURES: Feature[] = [
  {
    icon: 'boxes',
    title: 'Add products in minutes',
    body: 'Upload a photo, add a name and price, and publish. Group products into shelves customers can browse.',
    span: 2,
  },
  {
    icon: 'link',
    title: 'Share one link',
    body: 'Your shop link works in your bio, status, flyers and replies.',
    span: 1,
  },
  {
    icon: 'tag',
    title: 'Run discounts',
    body: 'Create percentage or fixed-amount promo codes with clear start and end dates.',
    span: 1,
  },
  {
    icon: 'palette',
    title: 'Make it your shop',
    body: 'Add your logo, banner and contact details so customers know exactly who they are buying from.',
    span: 2,
  },
  {
    icon: 'chat',
    title: 'Take orders on WhatsApp',
    body: 'Every checkout arrives itemised and totalled, then opens a pre-filled WhatsApp chat with the basket and customer note.',
    span: 2,
  },
  {
    icon: 'qr',
    title: 'Share anywhere',
    body: 'Send your shop on WhatsApp, Facebook, X or Telegram, or copy the link and post it anywhere.',
    span: 1,
  },
];

export const STEPS: { title: string; body: string }[] = [
  {
    title: 'Create your shop',
    body: 'Add your shop name, link and WhatsApp number. Your page is ready immediately.',
  },
  {
    title: 'Add your products',
    body: 'Upload photos, set prices and stock, and organise products into shelves.',
  },
  {
    title: 'Share and sell',
    body: 'Post your link. Orders arrive priced, itemised and totalled.',
  },
];

export type BillingCycle = 'monthly' | 'yearly';

export type Plan = {
  id: string;
  name: string;
  tagline: string;
  /** Cedi amounts. PLACEHOLDER — edit freely. 0/0 means the free-trial entry plan. */
  monthly: number;
  yearly: number;
  cta: string;
  href: string;
  highlighted: boolean;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: 'trial',
    name: 'Free trial',
    tagline: `The full shop, free for ${TRIAL_DAYS} days.`,
    monthly: 0,
    yearly: 0,
    cta: 'Start free trial',
    href: '/signup',
    highlighted: false,
    features: [
      `Everything unlocked for ${TRIAL_DAYS} days`,
      'Unlimited products & shelves',
      'WhatsApp ordering & share link',
      'No card needed to start',
    ],
  },
  {
    id: 'shop',
    name: 'Shop',
    tagline: 'For shops taking orders every day.',
    monthly: 45,
    yearly: 450,
    cta: 'Choose Shop',
    href: '/signup',
    highlighted: true,
    features: [
      'Everything in the trial',
      'Unlimited products & shelves',
      'Sales analytics & reports',
      'Logo and shop branding',
      'Discount codes & promos',
    ],
  },
];

/** Whole-cedi saving of yearly vs 12× monthly, or null when it does not apply. */
export function yearlySavingsPct(plan: Plan): number | null {
  if (plan.monthly <= 0 || plan.yearly <= 0) return null;
  return Math.round((1 - plan.yearly / (plan.monthly * 12)) * 100);
}

export type BilledPrice = { amount: number; per: string; note: string | null };

export function billingPrice(plan: Plan, cycle: BillingCycle): BilledPrice {
  if (plan.monthly <= 0 && plan.yearly <= 0)
    return { amount: 0, per: `for ${TRIAL_DAYS} days`, note: 'No card needed' };
  if (cycle === 'monthly') return { amount: plan.monthly, per: '/mo', note: null };
  const perMonth = plan.yearly / 12;
  const whole = perMonth % 1 === 0;
  return {
    amount: plan.yearly,
    per: '/yr',
    note: `GH₵ ${perMonth.toLocaleString('en-GH', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}/mo billed yearly`,
  };
}

export const FAQS: { q: string; a: string }[] = [
  {
    q: 'Is it really free to start?',
    a: `Yes. Every new shop gets the full toolkit free for ${TRIAL_DAYS} days — no card, no charge. When the trial ends you pick a plan to keep selling; your shop and its data stay safe either way.`,
  },
  {
    q: 'What happens when my free trial ends?',
    a: `After ${TRIAL_DAYS} days the free trial ends and a paid plan keeps your shop live and orderable. We never charge anything automatically — you choose and pay for a plan yourself, and nothing is lost if you pause.`,
  },
  {
    q: 'Do my customers need the app?',
    a: 'No. Your shop is a plain web link that opens in any browser. Customers browse, fill a basket and check out without installing anything.',
  },
  {
    q: 'How do orders reach me?',
    a: 'Every checkout lands itemised and totalled in your dashboard and opens a pre-filled WhatsApp chat with the whole basket, so you confirm it in conversation.',
  },
  {
    q: 'Can I use my own photos and logo?',
    a: 'Yes. Upload product photos, add your logo and banner, and set the contact details customers should see.',
  },
  {
    q: 'How do customers pay?',
    a: 'Most shops confirm on WhatsApp and collect cash, mobile money or a bank transfer. Switching on Paystack adds card checkout on unpaid orders — the dashboard marks them paid automatically.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Plans are month-to-month, and you can stop whenever you like — there is no lock-in. Cancel and your page stays up; a plan simply keeps it orderable.',
  },
];

export const FOOTER_COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: 'Shop',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Showcase', href: '#showcase' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Log in', href: '/login' },
      { label: 'Get started', href: '/signup' },
      { label: 'Workspace', href: '/dashboard' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
];

export const SOCIALS: { label: string; href: string }[] = [
  { label: 'Instagram', href: 'https://instagram.com' },
  { label: 'TikTok', href: 'https://tiktok.com' },
  { label: 'WhatsApp', href: 'https://whatsapp.com' },
  { label: 'Facebook', href: 'https://facebook.com' },
  { label: 'X', href: 'https://x.com' },
];
