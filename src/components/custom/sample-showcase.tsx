// Sample showcase islands for the marketing home: an auto-playing product
// slideshow and a scroll-reveal wrapper. Client-only motion — the page itself
// stays a server component and keeps its copy.
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/components/landing/motion';

export type ShowcaseSlide = {
  name: string;
  shelf: string;
  price: string;
  image: string;
};

const AUTOPLAY_MS = 4500;

export function SampleSlideshow({ slides }: { slides: ShowcaseSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback(
    (next: number) => setIndex(((next % slides.length) + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (prefersReducedMotion()) return;
    timer.current = setInterval(
      () => setIndex((current) => (current + 1) % slides.length),
      AUTOPLAY_MS,
    );
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, slides.length]);

  const current = slides[index] ?? slides[0];
  if (!current) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Sample shop products"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
    >
      <div className="flex h-9 items-center gap-2 border-b border-border bg-muted/50 px-4">
        <span className="size-2 rounded-full bg-border" aria-hidden />
        <span className="size-2 rounded-full bg-border" aria-hidden />
        <span className="size-2 rounded-full bg-border" aria-hidden />
        <span className="ml-2 font-display text-caption font-semibold text-muted-foreground">
          tilo.app/store/amara-beads
        </span>
      </div>

      <div className="relative aspect-[4/3] bg-muted">
        {slides.map((slide, slideIndex) => (
          <Image
            key={slide.name}
            src={slide.image}
            alt={slideIndex === index ? `${slide.name} — ${slide.shelf} shelf sample` : ''}
            aria-hidden={slideIndex === index ? undefined : true}
            fill
            sizes="(min-width: 1024px) 38vw, 90vw"
            priority={slideIndex === 0}
            className="object-cover motion-safe:transition-opacity motion-safe:duration-700"
            style={{ opacity: slideIndex === index ? 1 : 0 }}
          />
        ))}
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous product"
            className="flex size-9 items-center justify-center rounded-full border border-border bg-card/90 text-foreground backdrop-blur"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next product"
            className="flex size-9 items-center justify-center rounded-full border border-border bg-card/90 text-foreground backdrop-blur"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 p-4 sm:px-5">
        <div className="min-w-0">
          <p key={current.name} className="truncate font-display text-base font-semibold">
            {current.name}
          </p>
          <p className="mt-0.5 text-caption text-muted-foreground">
            {current.shelf} · {current.price} · {index + 1} of {slides.length}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5" role="tablist" aria-label="Choose product">
          {slides.map((slide, slideIndex) => (
            <button
              key={slide.name}
              type="button"
              role="tab"
              aria-selected={slideIndex === index}
              aria-label={`Show ${slide.name}`}
              onClick={() => go(slideIndex)}
              className={
                slideIndex === index
                  ? 'h-2 w-6 rounded-full bg-primary'
                  : 'size-2 rounded-full bg-border hover:bg-muted-foreground'
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`motion-safe:transition-all motion-safe:duration-700 ${className}`}
      style={{
        transitionDelay: `${delay}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(18px)',
      }}
    >
      {children}
    </div>
  );
}
