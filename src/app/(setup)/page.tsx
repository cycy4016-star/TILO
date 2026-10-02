// Tilo marketing home. Calm, professional, business-ready.

import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  Flame,
  Images,
  Link2,
  MessageCircle,
  ShoppingBasket,
  Store,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { siteDescription, siteName } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: siteName },
  description: siteDescription,
  alternates: { canonical: '/' },
};

const TICKER = [
  'Boutiques',
  'Food vendors',
  'Depots',
  'Salons',
  'Pharmacies',
  'Makers',
  'Caterers',
  'Retailers',
];

const TOOLKIT = [
  {
    icon: Boxes,
    title: 'A shelf per category',
    body: 'Group products under shelves you name — Beads, Wall art, Pantry — and reorder them with a tap.',
  },
  {
    icon: Images,
    title: 'Photos that do the selling',
    body: 'One picture and a short blurb per product, shown on your shop page exactly as you put them.',
  },
  {
    icon: Link2,
    title: 'One link to share',
    body: 'Your shop lives at tilo.app/store/yourname — paste it into a bio, a status, or a reply to "how much?"',
  },
  {
    icon: ShoppingBasket,
    title: 'A basket, not a chat',
    body: 'Customers add several items and check out once. The order arrives priced, itemised and totalled.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp and SMS stay',
    body: 'Every product keeps a tap-to-message and tap-to-SMS line, so the conversation never goes dark.',
  },
  {
    icon: BarChart3,
    title: 'Week in numbers',
    body: 'One glance tells you what moved, what stalled, and what pays the rent.',
  },
];

const STEPS = [
  [
    '1',
    'Add your products',
    'Name, price, one photo each — then drop them onto the shelves you just named.',
  ],
  [
    '2',
    'Share your link',
    'One shop link for your bio, your status, your flyers, and every "where can I see it?".',
  ],
  [
    '3',
    'Orders arrive',
    'Multi-item baskets land in your dashboard with quantities and totals already worked out.',
  ],
];

export default function TiloHome() {
  return (
    <main className="bg-background text-foreground">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/[0.06] via-background to-background">
        <div className="mx-auto max-w-6xl px-5 pb-14 pt-14 sm:px-8 sm:pb-16 sm:pt-20">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Flame className="size-3.5 text-primary" aria-hidden /> Self-serve
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Store className="size-3.5" aria-hidden /> Live in minutes
            </span>
          </div>

          <h1 className="mt-8 max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            List it. Share it.
            <br />
            <span className="text-primary">Sell it.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-medium text-muted-foreground">
            Tilo gives you a shop page for your products — shelves, photos, prices — plus one link
            to share and a basket your customers fill themselves. WhatsApp and SMS stay attached.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <Button
              asChild
              size="lg"
              className="h-14 w-full justify-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              <Link href="/signup">
                Open your shop <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 w-full justify-center rounded-lg border-border bg-background px-8 text-base font-semibold hover:bg-muted sm:w-auto"
            >
              <Link href="/dashboard">See the workspace</Link>
            </Button>
          </div>

          <div className="mt-12 flex flex-wrap gap-x-10 gap-y-6">
            {[
              ['2 min', 'to publish a product'],
              ['1 link', 'to share everywhere'],
              ['24/7', 'customers can order'],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="text-3xl font-bold text-foreground">{value}</p>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="border-t border-border bg-card/60 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Built for {TICKER.join(' · ')}
        </p>
      </section>

      {/* THE SHIFT */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">The shift</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          From “how much?” in the DMs to <span className="text-primary">a shop that answers</span>
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Before Tilo
            </p>
            <ul className="mt-4 space-y-3 text-base font-medium text-muted-foreground sm:text-lg">
              <li>“How much again?” asked every day</li>
              <li>Prices living in old status posts</li>
              <li>Orders retyped by hand into a book</li>
              <li>“Is it still available?” at midnight</li>
            </ul>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-6 sm:p-8">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              <BadgeCheck className="size-4" aria-hidden /> With Tilo
            </p>
            <ul className="mt-4 space-y-3 text-base font-semibold sm:text-lg">
              <li>One shop link answers every price question</li>
              <li>Shelves you rename in a tap</li>
              <li>Multi-item baskets priced for you</li>
              <li>Hide a shelf and its products go with it</li>
            </ul>
          </div>
        </div>
      </section>

      {/* TOOLKIT */}
      <section
        id="toolkit"
        className="scroll-mt-20 border-y border-border bg-muted/40 py-16 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">
                The toolkit
              </p>
              <h2 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                Six tools that run the business
              </h2>
            </div>
            <Badge
              variant="secondary"
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
            >
              <Store className="mr-1 size-3.5" aria-hidden /> Built for the market
            </Badge>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLKIT.map((tool) => (
              <article
                key={tool.title}
                className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md sm:p-7"
              >
                <span className="inline-flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <tool.icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-5 text-xl font-bold">{tool.title}</h3>
                <p className="mt-2 font-medium text-muted-foreground">{tool.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* THREE STEPS */}
      <section id="steps" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">
          Three steps
        </p>
        <h2 className="mt-3 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          From an empty page to <span className="text-primary">taking orders</span>
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map(([step, title, body]) => (
            <div
              key={step}
              className="relative overflow-hidden rounded-xl border border-border bg-card p-6 sm:p-8"
            >
              <p className="inline-flex rounded-md bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
                {step}
              </p>
              <h3 className="mt-4 text-2xl font-bold">{title}</h3>
              <p className="mt-2 font-medium text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center gap-3 rounded-xl border border-border bg-card p-5 text-foreground">
          <BadgeCheck className="size-6 shrink-0 text-primary" aria-hidden />
          <p className="font-medium">
            No site build, no agency and no code — your shop link works the moment you publish it.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section
        id="start"
        className="scroll-mt-20 bg-foreground px-5 py-16 text-background sm:px-8 sm:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-primary">
            <Flame className="size-4" aria-hidden /> Your turn
          </p>
          <h2 className="mt-4 max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Put your shop up this afternoon.
          </h2>
          <p className="mt-5 max-w-xl text-lg font-medium text-background/70">
            Add your products, share one link, and take orders that arrive already priced, itemised
            and totalled.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <Button
              asChild
              size="lg"
              className="h-14 w-full justify-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              <Link href="/signup">
                Open your shop <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 w-full justify-center rounded-lg border-background/40 bg-transparent px-8 text-base font-semibold text-background hover:bg-background/10 hover:text-background sm:w-auto"
            >
              <Link href="/dashboard">Tour the workspace</Link>
            </Button>
          </div>
          <p className="mt-10 text-xs font-semibold uppercase tracking-[0.25em] text-background/60">
            hello@tilo.app · Made for growing African businesses
          </p>
        </div>
      </section>
    </main>
  );
}
