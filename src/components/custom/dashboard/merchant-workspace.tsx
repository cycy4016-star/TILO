// Tilza analytics hub: money owed, the balance sheet and what moves —
// Pulse, Intelligence and Products folded into one screen.
//
// Merchant workspace. This is the shop owner's OWN shop, so the page is
// unreachable for a platform operator — the route above it redirects them to
// the ops console, where cross-account data lives.
'use client';

import { ArrowUpRight, BarChart3, Flame, Store, Users } from 'lucide-react';
import Link from 'next/link';
import { MoneyToChaseCard } from '@/components/custom/dashboard/money-to-chase-card';
import { IntelligenceWorkspace } from '@/components/custom/intelligence-workspace';
import { ProductsWorkspace } from '@/components/custom/products-workspace';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';

export function MerchantWorkspace() {
  const { data: session } = useSession();
  const name = session?.user?.name?.split(' ')[0] ?? 'Chief';

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-xl bg-highlight p-5 text-highlight-foreground sm:p-7">
        <span
          aria-hidden
          className="absolute -right-10 -top-16 size-44 rounded-full border-[20px] border-white/20"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded bg-[#241205] px-2.5 py-1 text-caption font-bold uppercase tracking-[0.08em] text-white">
              <BarChart3 className="size-3.5" aria-hidden /> Seller centre
            </span>
            <h1 className="mt-3 break-words font-display text-h2 sm:text-h1">
              Good to see you, {name}.
            </h1>
            <p className="mt-2 max-w-[48ch] text-small font-medium text-[#3d1f0d] sm:text-body">
              Check what you are owed, what is selling and what needs attention today.
            </p>
          </div>
          <Button
            asChild
            className="h-11 w-full shrink-0 rounded-md bg-white px-5 font-bold text-[#241205] hover:bg-[#fff7ef] sm:w-auto"
          >
            <Link href="/dashboard/store">
              <Store aria-hidden className="size-4" /> Open the catalogue
              <ArrowUpRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>

      <div id="money-to-chase" className="scroll-mt-24">
        <MoneyToChaseCard />
      </div>

      <div id="balance-sheet" className="scroll-mt-24">
        <IntelligenceWorkspace hideIntro />
      </div>

      <div id="product-ranking" className="scroll-mt-24">
        <ProductsWorkspace hideIntro />
      </div>

      <section id="jump-pads" className="scroll-mt-24 grid gap-4 md:grid-cols-3">
        {[
          {
            icon: Store,
            title: 'Catalogue',
            body: 'Shelves, products, prices and photos.',
            href: '/dashboard/store',
            cta: 'Curate the shelf',
          },
          {
            icon: ArrowUpRight,
            title: 'Orders',
            body: 'Every sale, every status, one queue.',
            href: '/dashboard/orders',
            cta: 'Work the queue',
          },
          {
            icon: Users,
            title: 'Customers',
            body: 'Every customer, one search away.',
            href: '/dashboard/customers',
            cta: 'Open directory',
          },
        ].map((tile) => (
          <article key={tile.title} className="lift rounded-lg border border-border bg-card p-5">
            <span className="inline-flex size-10 items-center justify-center rounded-md bg-highlight-wash text-highlight-ink">
              <tile.icon className="size-5" aria-hidden />
            </span>
            <h2 className="mt-3 text-h4 font-display">{tile.title}</h2>
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

      <p className="flex items-center gap-2 text-caption text-muted-foreground">
        <Flame aria-hidden className="size-3.5 text-primary" />
        Numbers update the moment orders move — paid, pending or cancelled.
      </p>
    </div>
  );
}
