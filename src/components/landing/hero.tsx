// Landing hero: staggered entrance, floating store phone with cursor tilt,
// and a sticky bottom CTA that slides in once the hero scrolls out of view.
// Entrance and float animate transform/opacity only; reduced motion shows the
// final state with no movement.
'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SampleShop } from '@/components/custom/sample-stores';
import { PhoneMockup } from '@/components/custom/store-stage';
import { useReducedMotion } from '@/components/landing/motion';
import { Button } from '@/components/ui/button';
import { LANDING } from '@/lib/landing-content';

const ENTRANCE = 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6';

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

  // The sticky CTA must never sit on top of the closing band / footers — hide
  // it once #start (or the page footer) scrolls into view.
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

  return (
    <>
      <style>{`
        @keyframes hero-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-float { animation: none !important; }
        }
      `}</style>
      <section aria-label="Introduction" className="relative overflow-hidden bg-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 4%, color-mix(in oklab, var(--primary) 10%, transparent) 0, transparent 55%)',
          }}
        />
        <div className="container-page section relative">
          <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
            <div>
              <p
                className={`${ENTRANCE} inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-caption text-muted-foreground`}
                style={{ animationDelay: '0ms' }}
              >
                {LANDING.hero.eyebrow}
              </p>
              <h1
                className={`${ENTRANCE} mt-7 break-words text-balance font-display text-4xl leading-[1.08] sm:text-display`}
                style={{ animationDelay: '90ms' }}
              >
                {LANDING.hero.titleA}{' '}
                <span className="bg-gradient-to-r from-primary to-muted-foreground bg-clip-text text-transparent">
                  {LANDING.hero.titleAccent}
                </span>
              </h1>
              <p
                className={`${ENTRANCE} mt-6 max-w-[52ch] text-body-lg text-muted-foreground`}
                style={{ animationDelay: '180ms' }}
              >
                {LANDING.hero.sub}
              </p>
              <div
                className={`${ENTRANCE} mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4`}
                style={{ animationDelay: '270ms' }}
              >
                <Button
                  asChild
                  className="h-11 w-full rounded-md px-7 font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 sm:w-auto"
                >
                  <Link href={LANDING.hero.primary.href}>
                    {LANDING.hero.primary.label} <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-11 w-full rounded-md border-border bg-background px-7 font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted sm:w-auto"
                >
                  <Link href={LANDING.hero.secondary.href}>{LANDING.hero.secondary.label}</Link>
                </Button>
              </div>
              <p
                className={`${ENTRANCE} mt-6 text-caption text-muted-foreground`}
                style={{ animationDelay: '340ms' }}
              >
                {LANDING.hero.reassurance}
              </p>
            </div>

            <div className={`${ENTRANCE} mx-auto w-fit`} style={{ animationDelay: '200ms' }}>
              <div className="hero-float motion-safe:[animation:hero-float_7s_ease-in-out_infinite]">
                <PhoneMockup shop={shop} index={0} dispersed reduceMotion={reduceMotion} />
              </div>
              <p className="mt-3 text-center text-caption text-muted-foreground">
                {shop.name} · tilo.app/store/{shop.slug} — sample photos, yours go here.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky mobile CTA: slides up once the hero is out of view, and back
          down before the closing band / footer so it never covers them. */}
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
          tabIndex={showCta ? 0 : -1}
          className="h-12 w-full rounded-xl font-semibold shadow-xl"
        >
          <Link href={LANDING.hero.primary.href}>Get started free</Link>
        </Button>
      </div>
    </>
  );
}
