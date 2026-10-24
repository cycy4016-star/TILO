// Pricing: monthly/yearly toggle. Clearer tier hierarchy, stronger CTA rhythm.
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Reveal } from '@/components/custom/sample-showcase';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { type BillingCycle, billingPrice, PLANS } from '@/lib/landing-content';
import { TRIAL_DAYS } from '@/lib/trial';
import { cn } from '@/lib/utils';

export function Pricing() {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const yearly = cycle === 'yearly';

  return (
    <section id="pricing" aria-label="Pricing" className="scroll-mt-20 bg-background">
      <div className="container-page section">
        <Reveal>
          <p className="text-eyebrow">Pricing</p>
          <h2 className="mt-3 break-words text-balance font-display text-h2">
            Start free. Pick a plan when you&apos;re ready.
          </h2>
          <p className="mt-4 max-w-[60ch] text-body text-muted-foreground">
            Every new shop gets the full toolkit free for {TRIAL_DAYS} days — no card, no charge.
            When the trial ends, choose the plan that fits. Your shop and data stay safe either way.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-6 flex min-h-11 items-center justify-center gap-3">
            <span className={cn('text-small font-medium', !yearly && 'font-semibold')}>
              Monthly
            </span>
            <Switch
              checked={yearly}
              onCheckedChange={(checked) => setCycle(checked ? 'yearly' : 'monthly')}
              aria-label="Bill yearly instead of monthly"
            />
            <span className={cn('text-small font-medium', yearly && 'font-semibold')}>Yearly</span>
          </div>
        </Reveal>

        <div className="mx-auto mt-7 grid max-w-3xl items-stretch gap-4 md:grid-cols-2">
          {PLANS.map((plan, index) => {
            const price = billingPrice(plan, cycle);
            return (
              <Reveal key={plan.id} delay={index * 90} className="h-full">
                <article
                  className={cn(
                    'flex h-full flex-col rounded-lg border bg-card p-5 sm:p-6',
                    plan.highlighted
                      ? 'border-primary shadow-lg shadow-primary/10'
                      : 'border-border',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-h4">{plan.name}</h3>
                    {plan.highlighted && (
                      <span className="rounded bg-highlight px-2.5 py-1 text-caption font-bold text-highlight-foreground">
                        Most popular
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-small text-muted-foreground">{plan.tagline}</p>
                  <p className="mt-4 flex min-h-12 items-baseline gap-1">
                    <span
                      key={cycle}
                      className="font-display text-h2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
                    >
                      GH₵ {price.amount.toLocaleString('en-GH')}
                    </span>
                    <span className="text-small text-muted-foreground">{price.per}</span>
                  </p>
                  <p className="mt-1 min-h-5 text-caption text-muted-foreground">
                    {plan.monthly > 0 ? (
                      <span className="font-semibold text-primary">
                        {TRIAL_DAYS} days free, then GH₵ {plan.monthly.toLocaleString('en-GH')}/mo
                      </span>
                    ) : (
                      price.note
                    )}
                  </p>
                  <ul className="mt-4 grid gap-2.5 text-small">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span
                          aria-hidden
                          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={plan.highlighted ? 'default' : 'outline'}
                    size="lg"
                    className="mt-5 w-full font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20"
                  >
                    <Link href={plan.href}>{plan.cta}</Link>
                  </Button>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
