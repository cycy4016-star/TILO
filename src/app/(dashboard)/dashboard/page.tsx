// Tilo dashboard overview.
'use client';

import { Activity, ArrowUpRight, Bot, Flame, Sparkles, Users } from 'lucide-react';
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
    title: 'Motion',
    body: 'Orders move, statuses flip, nothing stalls.',
    href: '/dashboard/orders',
    cta: 'See the flow',
  },
  {
    icon: Bot,
    title: 'Switchboard',
    body: 'Rule the rhythm — nudges and flips on autopilot.',
    href: '/dashboard/automations',
    cta: 'Open the switchboard',
  },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const name = session?.user?.name?.split(' ')[0] ?? 'chief';

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-950 via-[#78350f] to-yellow-600 p-8 text-amber-50 sm:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(circle at 85% 20%, #facc15 0, transparent 35%), radial-gradient(circle at 10% 90%, #fcd34d 0, transparent 30%)',
          }}
        />
        <div className="relative flex flex-wrap items-center gap-3">
          <span className="inline-flex -rotate-2 items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.18em] text-amber-950">
            <Flame className="size-3.5" aria-hidden /> Boss mode
          </span>
          <span className="inline-flex rotate-1 items-center gap-1.5 rounded-full border-2 border-amber-50/40 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.18em]">
            <Sparkles className="size-3.5" aria-hidden /> Today&apos;s pulse
          </span>
        </div>
        <h1 className="relative mt-5 font-display text-4xl font-black uppercase leading-none sm:text-6xl">
          Yo {name},<br />
          let&apos;s move <span className="text-amber-300">work.</span>
        </h1>
        <p className="relative mt-3 max-w-md font-medium text-amber-100">
          The whole floor is yours — people, orders, and the queue in one loud view.
        </p>
        <Button
          asChild
          className="relative mt-6 h-12 rounded-full bg-amber-300 px-6 font-black uppercase tracking-wide text-amber-950 hover:bg-amber-200"
        >
          <Link href="/dashboard/customers">
            Hit the directory <ArrowUpRight aria-hidden />
          </Link>
        </Button>
      </section>

      <MoneyToChaseCard />

      <SmsUsageCard />

      <section className="grid gap-4 md:grid-cols-3">
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
