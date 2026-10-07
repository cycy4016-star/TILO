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
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 sm:p-10">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(circle at 82% 18%, color-mix(in oklab, var(--primary) 12%, transparent) 0, transparent 45%)',
          }}
        />
        <div className="relative flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-caption font-semibold text-primary">
            <Flame className="size-3.5" aria-hidden /> Command center
          </span>
        </div>
        <h1 className="relative mt-5 text-h1 font-display">Good to see you, {name}.</h1>
        <p className="relative mt-3 max-w-[46ch] text-body-lg text-muted-foreground">
          The whole business in one clear view — people, orders, and the queue.
        </p>
        <Button asChild className="relative mt-6 h-11 rounded-md px-6 font-semibold">
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
        {TILES.map((tile) => (
          <article key={tile.title} className="lift rounded-xl border border-border bg-card p-6">
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <tile.icon className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-h4 font-display">{tile.title}</h2>
            <p className="mt-1 text-small text-muted-foreground">{tile.body}</p>
            <Button
              asChild
              variant="link"
              className="mt-2 h-auto p-0 text-small font-semibold text-foreground hover:text-primary"
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
