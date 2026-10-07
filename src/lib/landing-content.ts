// Landing page content — every word on the marketing home lives here, typed,
// so copy, plans, FAQs and features can be edited without touching components.
//
// PRICES ARE PLACEHOLDERS: the cedi amounts below are stand-ins. Change them
// here and the pricing section, toggle math and tests follow automatically.
export const LANDING = {
  hero: {
    eyebrow: 'For boutiques, food vendors, makers & more',
    titleA: 'Turn your bio link into a shop',
    titleAccent: 'that sells for you.',
    sub: 'Shelves, photos and prices on one page — customers fill a basket themselves, and orders land in your dashboard, confirmed on WhatsApp.',
    primary: { label: 'Create your store free', href: '/signup' },
    secondary: { label: 'See live examples', href: '#showcase' },
    reassurance: 'Free to start · No card needed · Live in minutes',
  },
  proof: {
    line: 'Works wherever your customers find you',
    // PLACEHOLDER NUMBERS — replace with real counts when available.
    stats: [
      { value: 120, suffix: '+', label: 'shops launched' },
      { value: 3400, suffix: '+', label: 'orders placed', comma: true },
      { value: 2, suffix: ' min', label: 'to publish a product' },
    ],
    testimonial: {
      quote:
        'My customers stopped asking “how much?” — the link answers everything before they even message me.',
      name: 'Ama Serwaa, Amara Beads (placeholder)',
    },
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
    body: 'tilo.app/store/yourname works in bios, statuses, flyers and replies.',
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
    body: 'Six colour themes and two layouts. Your shop looks like you, not like a template.',
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
    title: 'Share & QR code',
    body: 'Copy the link or print the code for your counter and packaging.',
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
  /** Cedi amounts. PLACEHOLDER — edit freely. 0/0 means free forever. */
  monthly: number;
  yearly: number;
  cta: string;
  href: string;
  highlighted: boolean;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Taste the whole shop, free.',
    monthly: 0,
    yearly: 0,
    cta: 'Start free',
    href: '/signup',
    highlighted: false,
    features: ['1 shop page', '20 products', 'WhatsApp ordering', 'Share link & QR'],
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
      'Everything in Starter',
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
    features: ['Everything in Shop', 'Up to 3 staff seats', 'Sales analytics', 'Priority support'],
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
    return { amount: 0, per: 'forever', note: 'Free forever' };
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
    a: 'Yes. The Starter plan is free forever — one shop page, 20 products and WhatsApp ordering. No card needed to sign up.',
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
    a: 'Yes. Upload product photos and your logo, then pick from six colour themes and two layouts to match your brand.',
  },
  {
    q: 'How do customers pay?',
    a: 'Most shops confirm on WhatsApp and collect cash, mobile money or a bank transfer. Switching on Paystack adds card checkout on unpaid orders — the dashboard marks them paid automatically.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Plans are month-to-month (or yearly if you take the discount) and your shop page stays up on the free plan if you cancel.',
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
