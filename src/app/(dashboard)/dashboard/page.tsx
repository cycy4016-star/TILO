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
    iconClassName: 'bg-sky-600',
  },
  {
    icon: Activity,
    title: 'Orders',
    body: 'Orders move, statuses flip, nothing stalls.',
    href: '/dashboard/orders',
    cta: 'See the flow',
    iconClassName: 'bg-emerald-600',
  },
  {
    icon: Bot,
    title: 'Automations',
    body: 'Nudges and status flips on autopilot.',
    href: '/dashboard/automations',
    cta: 'Open automations',
    iconClassName: 'bg-primary',
  },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const name = session?.user?.name?.split(' ')[0] ?? 'Chief';

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-xl border border-border bg-card p-8 sm:p-10">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(circle at 82% 18%, color-mix(in oklab, var(--primary) 16%, transparent) 0, transparent 42%), radial-gradient(circle at 12% 88%, oklch(0.62 0.13 175 / 0.14) 0, transparent 40%), radial-gradient(circle at 98% 82%, oklch(0.57 0.17 245 / 0.12) 0, transparent 44%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 size-48 rounded-full bg-emerald-200/40 blur-3xl motion-safe:animate-tilo-float"
          style={{ animationDuration: '7s' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-14 left-8 size-56 rounded-full bg-sky-200/40 blur-3xl motion-safe:animate-tilo-float"
          style={{ animationDuration: '9s', animationDelay: '1s' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/4 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent motion-safe:animate-tilo-sheen"
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
            className={`rounded-xl border border-border bg-card p-6 ${
              i === 0 ? 'shadow-sm' : ''
            } motion-safe:hover:-translate-y-0.5`}
          >
            <span
              className={`inline-flex size-11 items-center justify-center rounded-xl text-white shadow-sm ${tile.iconClassName}`}
            >
              <tile.icon className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-lg font-bold tracking-tight">{tile.title}</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">{tile.body}</p>
            <Button
              asChild
              variant="link"
              className="mt-2 h-auto p-0 font-semibold text-foreground hover:text-primary"
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
