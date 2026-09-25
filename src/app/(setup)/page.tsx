// Tilo marketing home. Calm, professional, business-ready.

import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  ClipboardList,
  Flame,
  HeartHandshake,
  MessagesSquare,
  Store,
  Truck,
  Wallet,
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
    icon: MessagesSquare,
    title: 'Chat inbox, organised',
    body: 'Every WhatsApp thread becomes a trackable conversation — nothing slips through the cracks.',
  },
  {
    icon: ClipboardList,
    title: 'Orders with memory',
    body: 'Quotes, jobs, and deliveries stay attached to the customer who asked for them.',
  },
  {
    icon: Boxes,
    title: 'Stock that flags itself',
    body: 'Low shelves raise their hand before your best seller runs dry mid-week.',
  },
  {
    icon: Wallet,
    title: 'Money, mobile-first',
    body: 'Invoices and MoMo payments sit next to the work they belong to.',
  },
  {
    icon: HeartHandshake,
    title: 'Follow-up fuel',
    body: 'A clear queue of who to nudge, when, and why — no more cold leads.',
  },
  {
    icon: BarChart3,
    title: 'Week in numbers',
    body: 'One glance tells you what moved, what stalled, and what pays the rent.',
  },
];

const WEEK = [
  ['Mon', 'Map the chaos', 'We shadow your busiest day and sketch how work really flows.'],
  ['Wed', 'Build your Tilo', 'Customers, orders, and queues get shaped around your trade.'],
  ['Fri', 'Launch day', 'Your team runs a real market day on Tilo, with us by your side.'],
];

const DAYS = [
  { label: 'M', id: 'mon', workday: true },
  { label: 'T', id: 'tue', workday: true },
  { label: 'W', id: 'wed', workday: true },
  { label: 'T', id: 'thu', workday: true },
  { label: 'F', id: 'fri', workday: true },
  { label: 'S', id: 'sat', workday: false },
  { label: 'S', id: 'sun', workday: false },
];

export default function TiloHome() {
  return (
    <main className="bg-background text-foreground">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/[0.06] via-background to-background">
        <div className="mx-auto max-w-6xl px-5 pb-14 pt-14 sm:px-8 sm:pb-16 sm:pt-20">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Flame className="size-3.5 text-primary" aria-hidden /> New
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Store className="size-3.5" aria-hidden /> Built for chat-led teams
            </span>
          </div>

          <h1 className="mt-8 max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Chat. Sell.
            <br />
            <span className="text-primary">Repeat.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-medium text-muted-foreground">
            Tilo turns your buzzing WhatsApp into a business that runs itself — customers, orders,
            stock, and follow-ups all in one calm place.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <Button
              asChild
              size="lg"
              className="h-14 w-full justify-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              <a href="mailto:hello@tilo.app?subject=Put%20my%20business%20on%20Tilo">
                Start on Tilo <ArrowRight aria-hidden className="size-4" />
              </a>
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

          <div className="mt-12 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-10">
            <div className="sm:flex sm:items-center sm:gap-4">
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {DAYS.map((day) => (
                  <div
                    key={day.id}
                    className={`flex aspect-square items-center justify-center rounded-md text-sm font-semibold sm:text-base ${
                      day.workday
                        ? 'bg-primary/10 text-primary'
                        : 'border border-dashed border-border text-muted-foreground'
                    }`}
                  >
                    {day.label}
                  </div>
                ))}
              </div>
              <p className="mt-3 max-w-[10rem] text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:mt-0">
                Your week, finally in tune
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              {[
                ['120+', 'chats organised weekly'],
                ['7 days', 'to go live'],
                ['1', 'place for it all'],
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
        </div>

        <p className="border-t border-border bg-card/60 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Built for {TICKER.join(' · ')}
        </p>
      </section>

      {/* THE SHIFT */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">The shift</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          From messy inbox to <span className="text-primary">a system that works</span>
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Before Tilo
            </p>
            <ul className="mt-4 space-y-3 text-base font-medium text-muted-foreground sm:text-lg">
              <li>“Who promised what on Tuesday?”</li>
              <li>Quotes lost between voice notes</li>
              <li>Stock surprises at the worst hour</li>
              <li>Follow-ups living in someone&apos;s head</li>
            </ul>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-6 sm:p-8">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              <BadgeCheck className="size-4" aria-hidden /> With Tilo
            </p>
            <ul className="mt-4 space-y-3 text-base font-semibold sm:text-lg">
              <li>Every promise has an owner and a date</li>
              <li>Orders ride along with their customer</li>
              <li>Low stock waves a flag early</li>
              <li>The queue tells you who to call next</li>
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

      {/* GO LIVE IN A WEEK */}
      <section id="week" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">
          Go live in a week
        </p>
        <h2 className="mt-3 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          From Monday chaos to <span className="text-primary">Friday launch</span>
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {WEEK.map(([day, title, body]) => (
            <div
              key={day}
              className="relative overflow-hidden rounded-xl border border-border bg-card p-6 sm:p-8"
            >
              <p className="inline-flex rounded-md bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
                {day}
              </p>
              <h3 className="mt-4 text-2xl font-bold">{title}</h3>
              <p className="mt-2 font-medium text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center gap-3 rounded-xl border border-border bg-card p-5 text-foreground">
          <Truck className="size-6 shrink-0 text-primary" aria-hidden />
          <p className="font-medium">
            We come to you. Real counters, real rush hour, real practice — not slides.
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
            Give us the messy inbox. We&apos;ll bring the system.
          </h2>
          <p className="mt-5 max-w-xl text-lg font-medium text-background/70">
            Tell us where work gets stuck today. In seven days, your whole team could be running on
            one rhythm.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <Button
              asChild
              size="lg"
              className="h-14 w-full justify-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              <a href="mailto:hello@tilo.app?subject=Put%20my%20business%20on%20Tilo">
                Get Tilo <ArrowRight aria-hidden className="size-4" />
              </a>
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
