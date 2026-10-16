// Landing page content — every word on the marketing home lives here, typed,
// so copy, plans, FAQs and features can be edited without touching components.
//
// PRICES ARE PLACEHOLDERS: the cedi amounts below are stand-ins. Change them
// here and the pricing section, toggle math and tests follow automatically.
import { TRIAL_DAYS } from '@/lib/trial';

export const LANDING = {
  hero: {
    eyebrow: 'For boutiques, food vendors, makers & more',
    titleA: 'Turn your bio link into a shop',
    titleAccent: 'that sells for you.',
    sub: 'Shelves, photos and prices on one page — customers fill a basket themselves, and orders land in your dashboard, confirmed on WhatsApp.',
    primary: { label: 'Start your free trial', href: '/signup' },
    secondary: { label: 'See live examples', href: '#showcase' },
    reassurance: `${TRIAL_DAYS} days free · No card needed · Live in minutes`,
  },
  proof: {
    line: `${TRIAL_DAYS} days free — the whole toolkit, no card needed`,
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
    title: 'A catalogue in minutes',
    body: 'Name, price, one photo each — then drop products onto shelves you name yourself. No site builder, no code.',
    span: 2,
  },
  {
    icon: 'link',
    title: 'One link for every bio',
    body: 'tilza.org/store/yourname works in bios, statuses, flyers and replies.',
    span: 1,
  },
  {
    icon: 'tag',
    title: 'Discounts & promos',
    body: 'Percentage or fixed-amount codes with live windows — customers see them as “Today’s offers” and quote the code in chat.',
    span: 1,
  },
  {
    icon: 'palette',
    title: 'Themes & brand colours',
    body: 'Seven colour themes and two layouts. Your shop looks like you, not like a template.',
    span: 2,
  },
  {
    icon: 'chat',
    title: 'Orders on WhatsApp',
    body: 'The basket checks out into a pre-filled chat carrying every line, the total and the customer’s note.',
    span: 2,
  },
  {
    icon: 'qr',
    title: 'Share anywhere',
    body: 'Copy the link for bios, statuses, flyers and replies — plus WhatsApp, Facebook, X and Telegram sharing on every product.',
    span: 1,
  },
];

export const STEPS: { title: string; body: string }[] = [
  {
    title: 'Create your store',
    body: 'Name it, pick a link word, add your WhatsApp number. Your page exists immediately.',
  },
  {
    title: 'Add products',
    body: 'Products and services with photos, prices and sale badges, grouped on shelves.',
  },
  {
    title: 'Share your link',
    body: 'One link for every bio and status. Orders arrive priced, itemised and totalled.',
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
    tagline: 'The whole shop, free for 14 days.',
    monthly: 0,
    yearly: 0,
    cta: 'Start free trial',
    href: '/signup',
    highlighted: false,
    features: [
      'Everything, unlocked for 14 days',
      'Unlimited products & shelves',
      'WhatsApp ordering & share link',
      'No card needed to start',
    ],
  },
  {
    id: 'shop',
    name: 'Shop',
    tagline: 'For businesses taking daily orders.',
    monthly: 45,
    yearly: 450,
    cta: 'Grow with Shop',
    href: '/signup',
    highlighted: true,
    features: [
      'Everything in the trial',
      'Unlimited products & shelves',
      'Sales analytics & reports',
      'Themes & brand colours',
      'Discount codes & promos',
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    tagline: 'For teams and high volume.',
    monthly: 120,
    yearly: 1200,
    cta: 'Talk to us',
    href: '/signup',
    highlighted: false,
    features: ['Everything in Shop', 'Sales analytics', 'Priority support'],
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
    q: 'Can I use my own photos and colours?',
    a: 'Yes. Upload product photos and your logo, then pick from the colour themes to match your brand.',
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
