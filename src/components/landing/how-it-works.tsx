// How-it-works: scroll-driven progress rail. Stronger rhythm, clearer step
// headings. Copy unchanged.

'use client';

import { useEffect, useRef, useState } from 'react';
import { Reveal } from '@/components/custom/sample-showcase';
import { useReducedMotion } from '@/components/landing/motion';
import { STEPS } from '@/lib/landing-content';

export function HowItWorks() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      setProgress(1);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const node = sectionRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const centre = window.innerHeight * 0.6;
      const value = (centre - rect.top) / rect.height;
      setProgress(Math.min(1, Math.max(0, value)));
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [reduceMotion]);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      aria-label="How it works"
      className="scroll-mt-20 bg-card"
    >
      <div className="container-page section">
        <Reveal>
          <p className="text-eyebrow">Three steps</p>
          <h2 className="mt-3 max-w-2xl break-words font-display text-h2">
            From an empty page to <span className="text-primary">taking orders</span>
          </h2>
        </Reveal>
        <div className="relative mt-9 grid gap-10 pl-10 md:grid-cols-3 md:gap-8 md:pl-0 md:pt-10">
          {/* Rail. */}
          <div
            aria-hidden
            className="absolute bottom-2 left-[19px] top-2 w-px rounded-full bg-border md:bottom-auto md:left-0 md:right-0 md:top-[19px] md:h-px md:w-auto"
          >
            <div
              className="size-full origin-top rounded-full bg-primary md:hidden"
              style={{ transform: `scaleY(${progress})` }}
            />
            <div
              className="hidden size-full origin-left rounded-full bg-primary md:block"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
          {STEPS.map((step, index) => (
            <Reveal key={step.title} delay={index * 100}>
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute -left-10 top-0 flex size-9 items-center justify-center rounded-full border border-primary/40 bg-card font-display text-small font-semibold text-primary shadow-xs md:-top-10 md:left-0"
                >
                  {index + 1}
                </span>
                <h3 className="font-display text-h4">{step.title}</h3>
                <p className="mt-1.5 max-w-[52ch] text-small text-muted-foreground">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
