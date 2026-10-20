// Landing hero: a marketplace storefront preview rather than a floating phone.
// The orange promo panel carries the offer, the product tile grid shows what a
// customer actually sees, and the sticky mobile CTA appears once the hero has
// scrolled away.
'use client';

import { ArrowRight, RotateCcw, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SampleShop } from '@/components/custom/sample-stores';
import { useReducedMotion } from '@/components/landing/motion';
import { Button } from '@/components/ui/button';
import { LANDING } from '@/lib/landing-content';

const ENTRANCE = 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6';

const CATEGORIES = ['Phones', 'Fashion', 'Food', 'Home', 'Beauty', 'Art', 'Accessories'];

const PROMISES = [
  { Icon: Truck, label: 'Delivery options' },
  { Icon: ShieldCheck, label: 'Buy with confidence' },
  { Icon: RotateCcw, label: 'Easy to update' },
];

export function Hero({ shop }: { shop: SampleShop }) {
  const reduceMotion = useReducedMotion();
  const [pastHero, setPastHero] = useState(false);
  const [pastClosing, setPastClosing] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.85);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reduceMotion]);

  // The sticky CTA must never sit on top of the closing band / footers.
  useEffect(() => {
    const target = document.getElementById('start') ?? document.querySelector('footer');
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => setPastClosing(entries[0]?.isIntersecting ?? false),
      { rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const showCta = pastHero && !pastClosing;
  const products = shop.products.slice(0, 4);

  return (
    <>
      <section aria-label="Introduction" className="border-b border-border bg-card">
        <div className="container-page py-5 sm:py-7">
          <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr] lg:gap-5">
            <div className="relative overflow-hidden rounded-xl bg-highlight p-6 text-highlight-foreground sm:p-9">
              <span
                aria-hidden
                className="absolute -right-16 -top-16 size-48 rounded-full border-[22px] border-white/20"
              />
              <span
                aria-hidden
                className="absolute -bottom-20 right-16 size-40 rounded-full bg-white/15"
              />

              <div className="relative">
                <p
                  className={`${ENTRANCE} inline-flex items-center gap-2 rounded-md bg-[#241205] px-3 py-1.5 text-caption font-bold uppercase tracking-[0.08em] text-white`}
                  style={{ animationDelay: '0ms' }}
                >
                  {LANDING.hero.eyebrow}
                </p>
                <h1
                  className={`${ENTRANCE} mt-5 max-w-[12ch] break-words text-balance font-display text-h1 sm:text-display`}
                  style={{ animationDelay: '80ms' }}
                >
                  {LANDING.hero.titleA}{' '}
                  <span className="block underline decoration-[#241205]/30 decoration-4 underline-offset-[6px]">
                    {LANDING.hero.titleAccent}
                  </span>
                </h1>
                <p
                  className={`${ENTRANCE} mt-5 max-w-[48ch] text-body text-[#3d1f0d]`}
                  style={{ animationDelay: '160ms' }}
                >
                  {LANDING.hero.sub}
                </p>
                <div
                  className={`${ENTRANCE} mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center`}
                  style={{ animationDelay: '240ms' }}
                >
                  <Button
                    asChild
                    size="xl"
                    className="w-full bg-white font-bold text-[#241205] hover:bg-[#fff7ef] sm:w-auto"
                  >
                    <Link href={LANDING.hero.primary.href}>
                      {LANDING.hero.primary.label} <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="xl"
                    className="w-full border-[#241205]/25 bg-transparent font-bold text-[#241205] hover:border-[#241205]/50 hover:bg-white/20 hover:text-[#241205] sm:w-auto"
                  >
                    <Link href={LANDING.hero.secondary.href}>{LANDING.hero.secondary.label}</Link>
                  </Button>
                </div>
                <p
                  className={`${ENTRANCE} mt-4 text-caption font-semibold text-[#3d1f0d]`}
                  style={{ animationDelay: '300ms' }}
                >
                  {LANDING.hero.reassurance}
                </p>
                <ul className="relative mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#241205]/15 pt-4">
                  {PROMISES.map(({ Icon, label }) => (
                    <li
                      key={label}
                      className="flex items-center gap-1.5 text-caption font-semibold text-[#3d1f0d]"
                    >
                      <Icon aria-hidden className="size-4" /> {label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div
              className={`${ENTRANCE} grid grid-cols-2 gap-3`}
              style={{ animationDelay: '180ms' }}
            >
              {products.map((product) => (
                <article
                  key={product.name}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
                >
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 45vw, 260px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {product.badge ? (
                      <span className="absolute left-2 top-2 rounded bg-destructive px-1.5 py-0.5 text-caption font-bold text-white">
                        {product.badge}
                      </span>
                    ) : null}
                    <span className="absolute bottom-2 right-2 grid size-8 place-items-center rounded-full bg-highlight text-highlight-foreground shadow-sm">
                      <ShoppingCart aria-hidden className="size-4" />
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-2.5">
                    <p className="line-clamp-1 text-caption font-medium text-muted-foreground">
                      {product.shelf}
                    </p>
                    <h2 className="line-clamp-2 text-small font-semibold leading-snug">
                      {product.name}
                    </h2>
                    <p className="mt-auto pt-1.5 flex flex-wrap items-baseline gap-1.5">
                      <span className="text-small font-bold text-primary">{product.price}</span>
                      {product.was ? (
                        <span className="text-caption text-muted-foreground line-through">
                          {product.was}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <nav aria-label="Shop categories" className="mt-4 overflow-x-auto">
            <ul className="flex min-w-max items-center gap-2">
              <li className="pr-1 text-caption font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Popular
              </li>
              {CATEGORIES.map((category) => (
                <li key={category}>
                  <Link
                    href="#showcase"
                    className="inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-small font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    {category}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      {/* Sticky mobile CTA: slides up once the hero is out of view. */}
      <div
        aria-hidden={!showCta}
        className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:hidden"
        style={{
          transform: showCta && !reduceMotion ? 'translateY(0)' : 'translateY(120%)',
          opacity: showCta ? 1 : 0,
          transition: reduceMotion ? 'none' : 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
          pointerEvents: showCta ? 'auto' : 'none',
        }}
      >
        <Button
          asChild
          size="xl"
          tabIndex={showCta ? 0 : -1}
          className="w-full bg-primary font-bold text-primary-foreground shadow-lg"
        >
          <Link href={LANDING.hero.primary.href}>{LANDING.hero.primary.label}</Link>
        </Button>
      </div>
    </>
  );
}
