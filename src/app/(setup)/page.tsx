// Tilo marketing home. Warm, loud, poster-style — nothing like the old look.

import {
  ArrowDownRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  ClipboardList,
  Flame,
  HeartHandshake,
  MessagesSquare,
  PartyPopper,
  Sparkles,
  Store,
  Truck,
  Wallet,
  Zap,
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
    title: 'Chat inbox, tamed',
    body: 'Every WhatsApp thread becomes a trackable conversation — nothing slips past Friday.',
    tilt: '-rotate-1',
  },
  {
    icon: ClipboardList,
    title: 'Orders with memory',
    body: 'Quotes, jobs, and deliveries stay glued to the customer who asked for them.',
    tilt: 'rotate-1',
  },
  {
    icon: Boxes,
    title: 'Stock that shouts',
    body: 'Low shelves raise their hand before your best seller runs dry mid-week.',
    tilt: '-rotate-1',
  },
  {
    icon: Wallet,
    title: 'Money, mobile-first',
    body: 'Invoices and MoMo payments line up next to the work they belong to.',
    tilt: 'rotate-1',
  },
  {
    icon: HeartHandshake,
    title: 'Follow-up fuel',
    body: 'A living queue of who to nudge, when, and why — no more cold leads.',
    tilt: '-rotate-1',
  },
  {
    icon: BarChart3,
    title: 'Week in numbers',
    body: 'One glance tells you what moved, what stalled, and what pays the rent.',
    tilt: 'rotate-1',
  },
];

const WEEK = [
  ['Mon', 'Map the chaos', 'We shadow your busiest day and sketch how work really flows.'],
  ['Wed', 'Build your Tilo', 'Customers, orders, and queues get shaped around your trade.'],
  ['Fri', 'Party + handover', 'Your team runs a real market day on Tilo. Drums optional.'],
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

const MARQUEE = [0, 1].flatMap((lap) => TICKER.map((trade) => ({ trade, id: `${lap}-${trade}` })));

export default function TiloHome() {
  return (
    <main className="overflow-hidden bg-[#fffbeb] text-stone-900 dark:bg-stone-950 dark:text-amber-50">
      {/* HERO */}
      <section className="relative bg-gradient-to-br from-amber-950 via-[#78350f] to-yellow-600 text-amber-50">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, #fcd34d 0, transparent 35%), radial-gradient(circle at 80% 70%, #facc15 0, transparent 30%)',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pt-20">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex -rotate-2 items-center gap-1.5 rounded-full bg-amber-300 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-amber-950">
              <Flame className="size-3.5" aria-hidden /> Hot off the press
            </span>
            <span className="inline-flex rotate-1 items-center gap-1.5 rounded-full border-2 border-amber-50/40 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
              <Sparkles className="size-3.5" aria-hidden /> For chat-led teams
            </span>
          </div>

          <h1 className="mt-8 font-display text-[13vw] font-black uppercase leading-[0.9] tracking-tight sm:text-7xl lg:text-8xl">
            Chat. Sell.
            <br />
            <span className="text-outline-cream">Repeat.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-medium text-amber-100">
            Tilo turns your buzzing WhatsApp into a business that runs itself — customers, orders,
            stock, and follow-ups dancing to one loud rhythm.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button
              asChild
              size="lg"
              className="h-14 rounded-full bg-amber-300 px-8 text-base font-black uppercase tracking-wide text-amber-950 hover:bg-amber-200"
            >
              <a href="mailto:hello@tilo.app?subject=Put%20my%20business%20on%20Tilo">
                Start the party <PartyPopper aria-hidden />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 rounded-full border-2 border-amber-50/50 bg-transparent px-8 text-base font-black uppercase tracking-wide text-amber-50 hover:bg-amber-50/10 hover:text-amber-50"
            >
              <Link href="/dashboard">
                Peek inside <ArrowDownRight aria-hidden />
              </Link>
            </Button>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex items-center gap-2">
              {DAYS.map((day) => (
                <div
                  key={day.id}
                  className={`flex size-11 items-center justify-center rounded-2xl font-display text-sm font-black sm:size-12 ${
                    day.workday
                      ? 'bg-amber-300 text-amber-950'
                      : 'border-2 border-dashed border-amber-50/40 text-amber-100'
                  }`}
                >
                  {day.label}
                </div>
              ))}
              <p className="ml-2 hidden max-w-[10rem] text-xs font-bold uppercase tracking-widest text-amber-200 sm:block">
                Your week, finally in tune
              </p>
            </div>
            <div className="flex gap-6">
              {[
                ['120+', 'chats tamed weekly'],
                ['7 days', 'to go live'],
                ['1', 'place for it all'],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="font-display text-3xl font-black text-amber-300">{value}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-200">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ticker */}
        <div className="relative border-t-4 border-amber-950 bg-amber-300 py-3 text-amber-950">
          <div className="flex w-max animate-marquee gap-8 pr-8">
            {MARQUEE.map((entry) => (
              <span
                key={entry.id}
                className="flex items-center gap-8 whitespace-nowrap font-display text-sm font-black uppercase tracking-[0.2em]"
              >
                {entry.trade} <Zap className="size-4 fill-amber-950" aria-hidden />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* MESS → MUSIC */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-yellow-600">The shift</p>
        <h2 className="mt-3 max-w-2xl font-display text-4xl font-black uppercase leading-none sm:text-6xl">
          From mess to <span className="text-yellow-600">music</span>
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rotate-1 rounded-[2rem] border-2 border-dashed border-stone-300 bg-white/60 p-8 dark:bg-stone-900">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-stone-400">
              Before Tilo
            </p>
            <ul className="mt-4 space-y-3 text-lg font-medium text-stone-500 dark:text-stone-400">
              <li>“Who promised what on Tuesday?”</li>
              <li>Quotes lost between voice notes</li>
              <li>Stock surprises at the worst hour</li>
              <li>Follow-ups living in someone&apos;s head</li>
            </ul>
          </div>
          <div className="-rotate-1 rounded-[2rem] bg-amber-950 p-8 text-amber-50 shadow-2xl">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-amber-300">
              <BadgeCheck className="size-4" aria-hidden /> After Tilo
            </p>
            <ul className="mt-4 space-y-3 text-lg font-bold">
              <li>Every promise has an owner + a date</li>
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
        className="scroll-mt-20 border-y-4 border-amber-950 bg-amber-300 py-16 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-800">
                The toolkit
              </p>
              <h2 className="mt-3 font-display text-4xl font-black uppercase leading-none text-amber-950 sm:text-6xl">
                Six loud tools
              </h2>
            </div>
            <Badge className="rounded-full bg-amber-950 px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-300">
              <Store className="mr-1 size-3.5" aria-hidden /> Built for the market
            </Badge>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLKIT.map((tool) => (
              <article
                key={tool.title}
                className={`group rounded-[1.75rem] border-2 border-amber-950 bg-[#fffbeb] p-7 shadow-[6px_6px_0_0_#451a03] transition-transform duration-200 hover:rotate-0 hover:shadow-[3px_3px_0_0_#451a03] ${tool.tilt} dark:bg-stone-900`}
              >
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-yellow-600 text-white transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6">
                  <tool.icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-5 font-display text-xl font-black uppercase">{tool.title}</h3>
                <p className="mt-2 font-medium text-stone-600 dark:text-stone-300">{tool.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* THE WEEK */}
      <section id="week" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-yellow-600">
          Go live in a week
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-4xl font-black uppercase leading-none sm:text-6xl">
          Monday chaos, Friday <span className="text-yellow-600">festival</span>
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {WEEK.map(([day, title, body], i) => (
            <div
              key={day}
              className="relative overflow-hidden rounded-[2rem] border-2 border-amber-950 bg-white p-8 dark:bg-stone-900"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-2 -top-6 font-display text-[7rem] font-black leading-none text-amber-100 dark:text-stone-800"
              >
                {i + 1}
              </span>
              <p className="inline-block -rotate-2 rounded-full bg-yellow-600 px-3 py-1 font-display text-xs font-black uppercase tracking-widest text-white">
                {day}
              </p>
              <h3 className="mt-4 font-display text-2xl font-black uppercase">{title}</h3>
              <p className="mt-2 font-medium text-stone-600 dark:text-stone-300">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center gap-3 rounded-[1.75rem] border-2 border-dashed border-amber-400 bg-amber-50 p-5 text-amber-900 dark:bg-stone-900 dark:text-amber-200">
          <Truck className="size-6 shrink-0" aria-hidden />
          <p className="font-bold">
            We come to you. Real counters, real rush hour, real practice — not slides.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section
        id="start"
        className="scroll-mt-20 bg-yellow-600 px-5 py-16 text-white sm:px-8 sm:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.25em] text-amber-200">
            <PartyPopper className="size-4" aria-hidden /> Your turn
          </p>
          <h2 className="mt-4 max-w-3xl font-display text-5xl font-black uppercase leading-[0.95] sm:text-7xl">
            Bring the noise. We&apos;ll bring the system.
          </h2>
          <p className="mt-5 max-w-xl text-lg font-medium text-amber-100">
            Tell us where work gets stuck today. In seven days your whole team could be running on
            one rhythm.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button
              asChild
              size="lg"
              className="h-14 rotate-1 rounded-full bg-amber-950 px-8 text-base font-black uppercase tracking-wide text-amber-300 hover:bg-stone-900"
            >
              <a href="mailto:hello@tilo.app?subject=Put%20my%20business%20on%20Tilo">
                Get Tilo <ArrowDownRight aria-hidden />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 -rotate-1 rounded-full border-2 border-white/60 bg-transparent px-8 text-base font-black uppercase tracking-wide text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/dashboard">Tour the workspace</Link>
            </Button>
          </div>
          <p className="mt-10 text-xs font-black uppercase tracking-[0.25em] text-amber-200">
            hello@tilo.app · Made loud for growing African businesses
          </p>
        </div>
      </section>
    </main>
  );
}
