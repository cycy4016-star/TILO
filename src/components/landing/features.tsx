// Features bento: six cards on a 3-column grid with mixed spans, each with a
// small pure-CSS animated visual. Server-rendered; motion is transform/opacity
// micro-loops (pulse/ping) that vanish under prefers-reduced-motion via the
// motion-safe variant.
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
            className="w-10 rounded-md bg-primary/15"
            style={{ height: `${bar.height}px` }}
          />
        ))}
        <span
          className="w-10 rounded-md bg-primary"
          style={{ height: `${BARS[4]?.height ?? 88}px` }}
        />
      </div>
    );
  }
  if (icon === 'link') {
    return (
      <div
        aria-hidden
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 font-mono text-caption text-muted-foreground"
      >
        <Link2 className="size-3.5 text-primary" />
        tilo.app/store/you
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
      <div aria-hidden className="flex items-center gap-2">
        {['bg-primary', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-rose-500'].map(
          (swatch) => (
            <span key={swatch} className={cn('size-7 rounded-full border border-border', swatch)} />
          ),
        )}
      </div>
    );
  }
  if (icon === 'chat') {
    return (
      <div
        aria-hidden
        className="max-w-xs rounded-2xl rounded-bl-md border border-border bg-background px-4 py-2.5 text-small"
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
          <p className="text-eyebrow">The toolkit</p>
          <h2 className="mt-3 break-words text-balance font-display text-h2">
            Six tools that run the business
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = FEATURE_ICON_MAP[feature.icon];
            return (
              <Reveal
                key={feature.title}
                delay={(index % 3) * 90}
                className={feature.span === 2 ? 'sm:col-span-2 lg:col-span-2' : ''}
              >
                <article className="lift flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-7">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-h4">{feature.title}</h3>
                  <p className="mt-2 text-small text-muted-foreground">{feature.body}</p>
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
