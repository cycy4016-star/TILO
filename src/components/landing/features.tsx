// Features: server-rendered, motion-safe visuals. Clean grid with consistent
// card elevation and tighter vertical spacing.

import { Boxes, Link2, type LucideIcon, MessageCircle, Palette, QrCode, Tag } from 'lucide-react';
import { Reveal } from '@/components/custom/sample-showcase';
import { FEATURES, type FeatureIcon } from '@/lib/landing-content';
import { cn } from '@/lib/utils';

export const FEATURE_ICON_MAP: Record<FeatureIcon, LucideIcon> = {
  boxes: Boxes,
  link: Link2,
  tag: Tag,
  palette: Palette,
  chat: MessageCircle,
  qr: QrCode,
};

const BARS = [
  { id: 'bar-short', height: 38 },
  { id: 'bar-tall', height: 62 },
  { id: 'bar-mid', height: 48 },
  { id: 'bar-high', height: 74 },
  { id: 'bar-max', height: 88 },
];

const QR_CELLS = Array.from({ length: 25 }, (_, cell) => ({
  id: `qr-cell-${cell}`,
  on: (cell * 7) % 5 < 2,
}));

function Visual({ icon }: { icon: FeatureIcon }) {
  if (icon === 'boxes') {
    return (
      <div aria-hidden className="flex items-end gap-1.5">
        {BARS.slice(0, 4).map((bar) => (
          <span
            key={bar.id}
            className="w-9 rounded-md bg-primary/15"
            style={{ height: `${bar.height}px` }}
          />
        ))}
        <span
          className="w-9 rounded-md bg-primary"
          style={{ height: `${BARS[4]?.height ?? 88}px` }}
        />
      </div>
    );
  }
  if (icon === 'link') {
    return (
      <div
        aria-hidden
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-4 py-1.5 font-mono text-caption text-muted-foreground shadow-xs"
      >
        <Link2 className="size-3.5 text-primary" />
        tilza.org/store/you
      </div>
    );
  }
  if (icon === 'tag') {
    return (
      <div aria-hidden className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-primary px-2.5 py-1 font-mono text-caption font-semibold text-primary-foreground">
          STUDENT10
        </span>
        <span className="rounded-md border border-border px-2.5 py-1 font-mono text-caption text-muted-foreground line-through">
          GH₵ 300
        </span>
        <span className="text-caption font-semibold text-primary">GH₵ 250</span>
      </div>
    );
  }
  if (icon === 'palette') {
    return (
      <div
        aria-hidden
        className="w-full max-w-xs overflow-hidden rounded-lg border border-border bg-background shadow-xs"
      >
        <div className="relative h-14 bg-highlight">
          <span className="absolute right-2 top-2 rounded bg-white/85 px-2 py-0.5 text-caption font-semibold text-foreground">
            Banner
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 pb-3">
          <span className="-mt-4 grid size-9 shrink-0 place-items-center rounded-md border border-border bg-foreground text-caption font-bold text-background">
            TK
          </span>
          <span className="min-w-0 pt-0.5">
            <span className="block truncate text-caption font-semibold text-foreground">
              Your shop name
            </span>
            <span className="block text-caption text-muted-foreground">Open for orders</span>
          </span>
        </div>
      </div>
    );
  }
  if (icon === 'chat') {
    return (
      <div
        aria-hidden
        className="max-w-xs rounded-lg rounded-bl-md border border-border bg-background/95 px-4 py-2.5 text-small shadow-xs"
      >
        2 items · GH₵ 205.00 — send as WhatsApp message?
        <span className="ml-2 inline-flex size-2 rounded-full bg-primary motion-safe:animate-ping" />
      </div>
    );
  }
  return (
    <div aria-hidden className="grid w-fit grid-cols-5 gap-1">
      {QR_CELLS.map((cell) => (
        <span
          key={cell.id}
          className={cn('size-3 rounded-[3px]', cell.on ? 'bg-foreground' : 'bg-border')}
        />
      ))}
    </div>
  );
}

export function Features() {
  return (
    <section id="features" aria-label="Features" className="scroll-mt-20 bg-background">
      <div className="container-page section">
        <Reveal>
          <p className="text-eyebrow">Everything you need</p>
          <h2 className="mt-3 break-words text-balance font-display text-h2">
            Everything you need to sell online
          </h2>
          <p className="mt-4 max-w-[58ch] text-body text-muted-foreground">
            No website builder, no code and no complicated setup. Add your products and start taking
            orders.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = FEATURE_ICON_MAP[feature.icon];
            return (
              <Reveal
                key={feature.title}
                delay={(index % 3) * 80}
                className={feature.span === 2 ? 'sm:col-span-2 lg:col-span-2' : ''}
              >
                <article className="lift flex h-full flex-col rounded-lg border border-border bg-card p-5 sm:p-6">
                  <span className="inline-flex size-10 items-center justify-center rounded-md bg-highlight-wash text-highlight-ink">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-3 font-display text-h4">{feature.title}</h3>
                  <p className="mt-1.5 text-small text-muted-foreground">{feature.body}</p>
                  <div className="mt-auto pt-5">
                    <Visual icon={feature.icon} />
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
