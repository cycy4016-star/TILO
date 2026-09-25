// Tilo dashboard overview.
'use client';

import { Activity, ArrowUpRight, Bot, Flame, Users } from 'lucide-react';
import Link from 'next/link';
import { MoneyToChaseCard } from '@/components/custom/dashboard/money-to-chase-card';
import { SmsUsageCard } from '@/components/custom/dashboard/sms-usage-card';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';

const TILES = [
  {
    icon: Users,
    title: 'People',
    body: 'Every customer, one search away.',
    href: '/dashboard/customers',
    cta: 'Open directory',
  },
  {
    icon: Activity,
    title: 'Orders',
    body: 'Orders move, statuses flip, nothing stalls.',
    href: '/dashboard/orders',
    cta: 'See the flow',
  },
  {
    icon: Bot,
    title: 'Automations',
    body: 'Nudges and status flips on autopilot.',
    href: '/dashboard/automations',
    cta: 'Open automations',
  },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const name = session?.user?.name?.split(' ')[0] ?? 'Chief';

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-xl border border-border bg-card p-8 sm:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(circle at 85% 20%, #d4a017 0, transparent 35%), radial-gradient(circle at 10% 90%, #d4a017 0, transparent 30%)',
          }}
        />
        <div className="relative flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary">
            <Flame className="size-3.5" aria-hidden /> Command center
          </span>
        </div>
        <h1 className="relative mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Good to see you, {name}.
        </h1>
        <p className="relative mt-3 max-w-md font-medium text-muted-foreground">
          The whole business in one clear view — people, orders, and the queue.
        </p>
        <Button
          asChild
          className="relative mt-6 h-12 rounded-lg bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Link href="/dashboard/customers">
            Open the directory <ArrowUpRight aria-hidden />
          </Link>
        </Button>
      </section>

      <div id="money-to-chase" className="scroll-mt-24">
        <MoneyToChaseCard />
      </div>

      <div id="sms-usage" className="scroll-mt-24">
        <SmsUsageCard />
      </div>

      <section id="jump-pads" className="scroll-mt-24 grid gap-4 md:grid-cols-3">
        {TILES.map((tile, i) => (
          <article
            key={tile.title}
            className={`rounded-[1.75rem] border-2 border-amber-950 bg-[#fffbeb] p-6 shadow-[5px_5px_0_0_#451a03] dark:bg-stone-900 ${
              i === 1 ? 'rotate-1' : i === 2 ? '-rotate-1' : ''
            }`}
          >
            <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-yellow-600 text-white">
              <tile.icon className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 font-display text-xl font-black uppercase">{tile.title}</h2>
            <p className="mt-1 text-sm font-medium text-stone-600 dark:text-stone-300">
              {tile.body}
            </p>
            <Button
              asChild
              variant="link"
              className="mt-2 h-auto p-0 font-black uppercase tracking-wide text-amber-700 dark:text-amber-300"
            >
              <Link href={tile.href}>
                {tile.cta} <ArrowUpRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </article>
        ))}
      </section>
    </div>
  );
}
