// Sample-stores stage for the marketing home: the three sample shops as
// smartphone mockups that disperse from a single stack on scroll, plus a
// transposed comparison table (shops as columns, attributes as rows).
// Client component — IntersectionObserver drives the one-shot reveal and the
// tilt-on-hover; everything animates transform/opacity only.
'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { SampleShop } from '@/components/custom/sample-stores';
import { prefersReducedMotion } from '@/components/landing/motion';

const EASE_SPRING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const STAGGER_MS = 100;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => prefersReducedMotion());
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

function useOnceVisible<T extends HTMLElement>(threshold = 0.35) {
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

function priceToNumber(raw: string): number {
  const parsed = Number.parseFloat(raw.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function formatGhsLike(value: number): string {
  return `GH₵ ${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function shopStats(shop: SampleShop) {
  const onSale = shop.products.filter((product) => product.badge).length;
  const prices = shop.products
    .map((product) => priceToNumber(product.price))
    .filter(Number.isFinite);
  const location = shop.tagline.split('·').at(-1)?.trim() ?? '';
  return {
    items: shop.products.length,
    shelves: shop.shelves.length,
    onSale,
    location,
    from: prices.length > 0 ? formatGhsLike(Math.min(...prices)) : '—',
  };
}

export function PhoneMockup({
  shop,
  index,
  dispersed,
  reduceMotion,
}: {
  shop: SampleShop;
  index: number;
  dispersed: boolean;
  reduceMotion: boolean;
}) {
  const stats = shopStats(shop);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, hover: false });
  const shown = dispersed || reduceMotion;

  const direction = index % 2 === 0 ? 1 : -1;
  const resting: React.CSSProperties = shown
    ? { transform: 'translateX(0px) rotate(0deg) scale(1)', opacity: 1 }
    : {
        transform: `translateX(${index * -300}px) rotate(${direction * 8}deg) scale(0.94)`,
        opacity: index === 0 ? 1 : 0,
      };

  function handleMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!shown) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: -py * 8, ry: px * 10, hover: true });
  }

  const initial = shop.name.charAt(0).toUpperCase();

  return (
    <div
      className={shown ? '' : 'pointer-events-none'}
      style={{
        ...resting,
        transition: reduceMotion ? 'none' : `transform 0.7s ${EASE_SPRING}, opacity 0.5s ease-out`,
        transitionDelay: reduceMotion ? '0ms' : `${index * STAGGER_MS}ms`,
      }}
    >
      <div style={{ perspective: '1100px' }}>
        <figure
          onMouseMove={handleMove}
          onMouseLeave={() => setTilt({ rx: 0, ry: 0, hover: false })}
          aria-label={`${shop.name} preview`}
          className="relative m-0 w-[272px] shrink-0 snap-center rounded-[3rem] bg-neutral-950 p-2.5 shadow-2xl ring-1 ring-border transition-shadow duration-300 md:w-full md:max-w-[300px] md:justify-self-center"
          style={{
            transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(${tilt.hover && shown ? -8 : 0}px)`,
            transition: 'transform 0.25s ease-out, box-shadow 0.3s ease-out',
            boxShadow:
              tilt.hover && shown
                ? '0 24px 60px -12px color-mix(in oklab, var(--primary) 35%, transparent), 0 12px 24px -12px rgb(0 0 0 / 0.4)'
                : undefined,
          }}
        >
          {/* Dynamic island */}
          <div
            aria-hidden
            className="absolute left-1/2 top-5 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black"
          />
          {/* Screen */}
          <div className="overflow-hidden rounded-[2.4rem] bg-card">
            <div className="bg-gradient-to-br from-primary/25 via-primary/10 to-transparent px-4 pt-12 pb-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary font-display text-base font-semibold text-primary-foreground"
                >
                  {initial}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-semibold">{shop.name}</p>
                  <p className="truncate text-caption text-muted-foreground">
                    tilo.app/store/{shop.slug}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-caption font-semibold text-primary">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                  </span>
                  Live
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 px-4 py-3 text-center">
              {[
                [String(stats.items), 'items'],
                [String(stats.shelves), 'shelves'],
                [String(stats.onSale), 'on sale'],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-xl border border-border bg-background/60 px-1 py-2 backdrop-blur"
                >
                  <p className="text-base font-semibold">{value}</p>
                  <p className="text-caption text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 px-4">
              {shop.products.slice(0, 3).map((product) => (
                <div
                  key={product.name}
                  className="relative aspect-square overflow-hidden rounded-lg bg-muted"
                >
                  <Image src={product.image} alt="" fill sizes="90px" className="object-cover" />
                </div>
              ))}
            </div>
            <p className="px-4 pt-2 text-caption text-muted-foreground">
              From {stats.from} · {shop.tagline}
            </p>

            <div className="px-4 py-3">
              {shop.basket ? (
                <div className="flex items-center justify-between rounded-xl bg-foreground px-3 py-2.5 text-background">
                  <span className="text-caption font-semibold">
                    {shop.basket.count} items · {shop.basket.total}
                  </span>
                  <span className="rounded-md bg-primary px-2.5 py-1 text-caption font-semibold text-primary-foreground">
                    WhatsApp
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border px-3 py-2.5 text-center text-caption text-muted-foreground">
                  Open for orders
                </div>
              )}
            </div>
            <div aria-hidden className="mx-auto mb-2 h-1 w-24 rounded-full bg-border" />
          </div>
        </figure>
      </div>
    </div>
  );
}

export function StorePhones({ shops }: { shops: SampleShop[] }) {
  const reduceMotion = useReducedMotion();
  const { ref, visible } = useOnceVisible<HTMLDivElement>(0.35);
  const dispersed = visible || reduceMotion;

  return (
    <div ref={ref} className="mt-10">
      <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-4 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 lg:gap-8">
        {shops.map((shop, index) => (
          <PhoneMockup
            key={shop.slug}
            shop={shop}
            index={index}
            dispersed={dispersed}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-caption text-muted-foreground md:hidden">
        Swipe to browse the three shops
      </p>
    </div>
  );
}

export function StoreCompareTable({ shops }: { shops: SampleShop[] }) {
  const reduceMotion = useReducedMotion();
  const { ref, visible } = useOnceVisible<HTMLDivElement>(0.3);
  const ready = visible || reduceMotion;

  const rows: { label: string; values: string[] }[] = [
    { label: 'Status', values: shops.map(() => 'Live') },
    { label: 'Location', values: shops.map((shop) => shopStats(shop).location) },
    { label: 'Shelves', values: shops.map((shop) => String(shopStats(shop).shelves)) },
    { label: 'Items', values: shops.map((shop) => String(shopStats(shop).items)) },
    { label: 'On sale', values: shops.map((shop) => String(shopStats(shop).onSale)) },
    { label: 'Starting at', values: shops.map((shop) => shopStats(shop).from) },
    {
      label: 'Basket',
      values: shops.map((shop) =>
        shop.basket ? `${shop.basket.count} items · ${shop.basket.total}` : 'Open for orders',
      ),
    },
    { label: 'Shop link', values: shops.map((shop) => `tilo.app/store/${shop.slug}`) },
  ];

  return (
    <div ref={ref} className="mt-10">
      <style>{`
        .compare-scroll { scrollbar-width: thin; scrollbar-color: color-mix(in oklab, var(--primary) 55%, transparent) transparent; }
        .compare-scroll::-webkit-scrollbar { height: 8px; }
        .compare-scroll::-webkit-scrollbar-track { background: transparent; }
        .compare-scroll::-webkit-scrollbar-thumb { background: color-mix(in oklab, var(--primary) 45%, transparent); border-radius: 999px; }
        .compare-table tbody tr { opacity: 0; }
        .compare-table.is-visible tbody tr { animation: compare-row-in 0.55s ${EASE_SPRING} both; }
        .compare-table.is-visible tbody tr:nth-child(1) { animation-delay: 0ms; }
        .compare-table.is-visible tbody tr:nth-child(2) { animation-delay: 70ms; }
        .compare-table.is-visible tbody tr:nth-child(3) { animation-delay: 140ms; }
        .compare-table.is-visible tbody tr:nth-child(4) { animation-delay: 210ms; }
        .compare-table.is-visible tbody tr:nth-child(5) { animation-delay: 280ms; }
        .compare-table.is-visible tbody tr:nth-child(6) { animation-delay: 350ms; }
        .compare-table.is-visible tbody tr:nth-child(7) { animation-delay: 420ms; }
        .compare-table.is-visible tbody tr:nth-child(8) { animation-delay: 490ms; }
        @keyframes compare-row-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .compare-table tbody tr { opacity: 1; }
          .compare-table.is-visible tbody tr { animation: none; }
        }
      `}</style>
      <div className="compare-scroll overflow-x-auto rounded-2xl border border-border bg-card/80 shadow-xl backdrop-blur">
        <table
          className={`compare-table w-full min-w-[640px] border-collapse text-left ${ready ? 'is-visible' : ''}`}
        >
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-28 bg-card px-4 py-4 text-caption font-semibold uppercase tracking-widest text-muted-foreground"
              >
                Shops
              </th>
              {shops.map((shop) => (
                <th key={shop.slug} scope="col" className="min-w-44 px-4 py-4">
                  <span className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-small font-semibold text-primary-foreground"
                    >
                      {shop.name.charAt(0).toUpperCase()}
                    </span>
                    <span>
                      <span className="block text-small font-semibold">{shop.name}</span>
                      <span className="block text-caption font-normal text-muted-foreground">
                        tilo.app/store/{shop.slug}
                      </span>
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border/60 last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-card px-4 py-3 text-small font-semibold text-muted-foreground"
                >
                  {row.label}
                </th>
                {row.values.map((value, valueIndex) => (
                  <td key={`${row.label}-${valueIndex}`} className="px-4 py-3 text-small">
                    {row.label === 'Status' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-caption font-semibold text-primary">
                        <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                        {value}
                      </span>
                    ) : row.label === 'Shop link' ? (
                      <span className="font-mono text-caption text-primary">{value}</span>
                    ) : (
                      value
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
