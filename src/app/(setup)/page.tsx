// Tilo marketing home: conversion-focused landing for shop owners.
// Copy, plans, FAQs and features live in src/lib/landing-content.ts — edit
// there, not here. Showcase and store-stage sections are reused as-is.

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Reveal, SampleSlideshow } from '@/components/custom/sample-showcase';
import type { SampleShop } from '@/components/custom/sample-stores';
import { StoreCompareTable, StorePhones } from '@/components/custom/store-stage';
import { Closing, LandingFooter } from '@/components/landing/closing';
import { Faq } from '@/components/landing/faq';
import { Features } from '@/components/landing/features';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Pricing } from '@/components/landing/pricing';
import { SocialProof } from '@/components/landing/social-proof';
import { PLANS } from '@/lib/landing-content';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `${siteName} — Turn your bio link into a shop` },
  description: siteDescription,
  alternates: { canonical: '/' },
  openGraph: {
    title: `${siteName} — Turn your bio link into a shop`,
    description: siteDescription,
    url: '/',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: siteName }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteName} — Turn your bio link into a shop`,
    description: siteDescription,
    images: ['/opengraph-image'],
  },
};

const HERO_SLIDES = [
  {
    name: 'Nova X5, 128GB',
    shelf: 'Phones',
    price: 'GH₵ 2,450.00',
    image: '/samples/phone-nova.jpg',
  },
  {
    name: 'Court sneakers, red',
    shelf: 'Men',
    price: 'GH₵ 850.00',
    image: '/samples/sneakers-red.jpg',
  },
  {
    name: 'Butter croissants, 4',
    shelf: 'Bakes',
    price: 'GH₵ 60.00',
    image: '/samples/croissant.jpg',
  },
  {
    name: 'Floral summer dress',
    shelf: 'Women',
    price: 'GH₵ 420.00',
    image: '/samples/dress-floral.jpg',
  },
];

/* Sample shops — three trades, 8 products each. Rendered by the store stage
   (phone mockups + comparison table); the hero borrows the first for its
   floating phone. */
const SAMPLE_STORES: SampleShop[] = [
  {
    name: 'Phone Hub Accra',
    slug: 'phone-hub',
    tagline: 'Phones & accessories · Accra',
    shelves: ['Phones', 'Audio', 'Gadgets', 'Computing'],
    products: [
      {
        name: 'Nova X5, 128GB',
        shelf: 'Phones',
        price: 'GH₵ 2,450.00',
        was: null,
        badge: null,
        image: '/samples/phone-nova.jpg',
      },
      {
        name: 'Nova Pro Max',
        shelf: 'Phones',
        price: 'GH₵ 3,800.00',
        was: 'GH₵ 4,200.00',
        badge: '-10%',
        image: '/samples/phone-pro.jpg',
      },
      {
        name: 'Bass headphones',
        shelf: 'Audio',
        price: 'GH₵ 550.00',
        was: null,
        badge: null,
        image: '/samples/headphones.jpg',
      },
      {
        name: 'True wireless earbuds',
        shelf: 'Audio',
        price: 'GH₵ 320.00',
        was: 'GH₵ 400.00',
        badge: '-20%',
        image: '/samples/earbuds.jpg',
      },
      {
        name: 'Pulse smartwatch',
        shelf: 'Gadgets',
        price: 'GH₵ 890.00',
        was: null,
        badge: null,
        image: '/samples/smartwatch.jpg',
      },
      {
        name: 'Pro gamepad',
        shelf: 'Gadgets',
        price: 'GH₵ 450.00',
        was: null,
        badge: null,
        image: '/samples/gamepad.jpg',
      },
      {
        name: 'Ultrabook 14',
        shelf: 'Computing',
        price: 'GH₵ 7,200.00',
        was: null,
        badge: null,
        image: '/samples/laptop.jpg',
      },
      {
        name: 'Tab 11',
        shelf: 'Computing',
        price: 'GH₵ 1,950.00',
        was: 'GH₵ 2,300.00',
        badge: '-15%',
        image: '/samples/tablet.jpg',
      },
    ],
    basket: { count: 2, total: 'GH₵ 3,000.00' },
  },
  {
    name: 'His & Hers',
    slug: 'his-and-hers',
    tagline: 'Men & women fashion · Osu',
    shelves: ['Men', 'Women', 'Unisex'],
    products: [
      {
        name: 'Essential white tee',
        shelf: 'Men',
        price: 'GH₵ 120.00',
        was: null,
        badge: null,
        image: '/samples/tee-white.jpg',
      },
      {
        name: 'Graphic tees, 3-pack',
        shelf: 'Men',
        price: 'GH₵ 240.00',
        was: 'GH₵ 300.00',
        badge: '-20%',
        image: '/samples/tees-folded.jpg',
      },
      {
        name: 'Court sneakers, red',
        shelf: 'Men',
        price: 'GH₵ 850.00',
        was: null,
        badge: null,
        image: '/samples/sneakers-red.jpg',
      },
      {
        name: 'Floral summer dress',
        shelf: 'Women',
        price: 'GH₵ 420.00',
        was: null,
        badge: null,
        image: '/samples/dress-floral.jpg',
      },
      {
        name: 'White high-tops',
        shelf: 'Women',
        price: 'GH₵ 780.00',
        was: 'GH₵ 900.00',
        badge: '-13%',
        image: '/samples/sneakers-white.jpg',
      },
      {
        name: 'Cherry handbag',
        shelf: 'Women',
        price: 'GH₵ 640.00',
        was: null,
        badge: null,
        image: '/samples/handbag-red.jpg',
      },
      {
        name: 'Canvas backpack',
        shelf: 'Unisex',
        price: 'GH₵ 390.00',
        was: null,
        badge: null,
        image: '/samples/backpack.jpg',
      },
      {
        name: 'Aviator sunglasses',
        shelf: 'Unisex',
        price: 'GH₵ 280.00',
        was: 'GH₵ 350.00',
        badge: '-20%',
        image: '/samples/sunglasses.jpg',
      },
    ],
    basket: { count: 3, total: 'GH₵ 1,340.00' },
  },
  {
    name: 'Crumbs & Canvas',
    slug: 'crumbs-and-canvas',
    tagline: 'Fresh bakes & wall art · East Legon',
    shelves: ['Bakes', 'Cakes', 'Walls'],
    products: [
      {
        name: 'Samosa, box of 6',
        shelf: 'Bakes',
        price: 'GH₵ 45.00',
        was: null,
        badge: null,
        image: '/samples/samosa.jpg',
      },
      {
        name: 'Butter croissants, 4',
        shelf: 'Bakes',
        price: 'GH₵ 60.00',
        was: 'GH₵ 75.00',
        badge: '-20%',
        image: '/samples/croissant.jpg',
      },
      {
        name: 'Choc-chip cookies, 12',
        shelf: 'Bakes',
        price: 'GH₵ 70.00',
        was: null,
        badge: null,
        image: '/samples/cookies.jpg',
      },
      {
        name: 'Cupcakes, box of 6',
        shelf: 'Cakes',
        price: 'GH₵ 90.00',
        was: null,
        badge: null,
        image: '/samples/cupcakes.jpg',
      },
      {
        name: 'Glazed doughnuts, 4',
        shelf: 'Cakes',
        price: 'GH₵ 55.00',
        was: null,
        badge: null,
        image: '/samples/donuts.jpg',
      },
      {
        name: 'Chocolate fudge cake',
        shelf: 'Cakes',
        price: 'GH₵ 280.00',
        was: 'GH₵ 350.00',
        badge: '-20%',
        image: '/samples/cake.jpg',
      },
      {
        name: "'Harmattan' print, A3",
        shelf: 'Walls',
        price: 'GH₵ 320.00',
        was: null,
        badge: null,
        image: '/samples/painting.jpg',
      },
      {
        name: 'Gallery frames, set of 3',
        shelf: 'Walls',
        price: 'GH₵ 180.00',
        was: null,
        badge: null,
        image: '/samples/frames.jpg',
      },
    ],
    basket: null,
  },
];

export default async function TiloHome() {
  // CSP-safe JSON-LD: the per-request nonce keeps strict script-src happy.
  // The root layout already opts the tree into dynamic rendering for this.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const paid = PLANS.find((plan) => plan.highlighted) ?? PLANS[1];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: siteName,
        url: siteUrl,
        description: siteDescription,
      },
      {
        '@type': 'Product',
        name: `${siteName} shop page`,
        description: siteDescription,
        brand: { '@type': 'Brand', name: siteName },
        offers: {
          '@type': 'Offer',
          priceCurrency: 'GHS',
          price: paid ? String(paid.monthly) : '0',
          availability: 'https://schema.org/InStock',
        },
      },
    ],
  };

  return (
    <>
      <main className="bg-background text-foreground">
        {/* CSP-safe JSON-LD: static string of our own constants, nonce'd for strict script-src. */}
        <script
          type="application/ld+json"
          nonce={nonce}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON.stringify of typed local constants only — no user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Hero
          shop={
            SAMPLE_STORES[0] ?? {
              name: siteName,
              slug: 'tilo',
              tagline: '',
              shelves: [],
              products: [],
              basket: null,
            }
          }
        />
        <SocialProof />

        {/* SHOWCASE */}
        <section id="showcase" aria-label="Showcase" className="scroll-mt-20 bg-background">
          <div className="container-page section">
            <Reveal>
              <p className="text-eyebrow">Showcase</p>
              <h2 className="mt-3 max-w-2xl font-display text-h2">
                See what stores <span className="text-primary">look like</span>
              </h2>
              <p className="mt-5 max-w-[60ch] text-body-lg text-muted-foreground">
                Real sample shelves — photos, sale prices and order buttons, exactly as your
                customers will see them.
              </p>
            </Reveal>
            <Reveal delay={120}>
              <div className="mx-auto mt-10 max-w-2xl">
                <SampleSlideshow slides={HERO_SLIDES} />
              </div>
            </Reveal>
          </div>
        </section>

        {/* STORE STAGE */}
        <section aria-label="Sample shops" className="bg-muted/40">
          <div className="container-page section">
            <Reveal>
              <p className="text-eyebrow">Sample shops</p>
              <h2 className="mt-3 max-w-2xl font-display text-h2">
                Three trades, <span className="text-primary">one pattern</span>
              </h2>
              <p className="mt-5 max-w-[60ch] text-body-lg text-muted-foreground">
                Every shop below runs on shelves, photos and a basket — compare them side by side.
              </p>
            </Reveal>
            <StorePhones shops={SAMPLE_STORES} />
            <StoreCompareTable shops={SAMPLE_STORES} />
            <p className="mt-4 text-caption text-muted-foreground">
              Sample photos by Unsplash photographers (free to use) — drop your own product shots
              into <span className="font-mono">public/samples</span> to replace them.
            </p>
          </div>
        </section>

        <Features />
        <HowItWorks />
        <Pricing />
        <Faq />
        <Closing />
      </main>
      <LandingFooter />
    </>
  );
}
