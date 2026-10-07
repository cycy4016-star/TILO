// Shared landing-motion primitives: reduced-motion detection, one-shot
// scroll visibility, and an animated counter. Everything animates transform
// or opacity only; reduced-motion renders final states with no movement.
'use client';

import { useEffect, useRef, useState } from 'react';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function useOnceVisible<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
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
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/** Animated number that counts up when scrolled into view (final value when reduced motion). */
export function CountUp({
  to,
  suffix = '',
  comma = false,
  duration = 1200,
}: {
  to: number;
  suffix?: string;
  comma?: boolean;
  duration?: number;
}) {
  const reduceMotion = useReducedMotion();
  const { ref, visible } = useOnceVisible<HTMLSpanElement>(0.4);
  const [value, setValue] = useState(reduceMotion ? to : 0);

  useEffect(() => {
    if (!visible || reduceMotion) {
      if (visible) setValue(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(to * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, reduceMotion, to, duration]);

  const text = comma ? value.toLocaleString('en-GH') : String(value);
  return (
    <span ref={ref}>
      {text}
      {suffix}
    </span>
  );
}
