import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

// Metric tile for the analytics and admin surfaces.
//
// `tone` is chosen by the CALLER on purpose. "Up" is not universally good —
// up-and-to-the-right is lovely for revenue and alarming for unpaid orders —
// so the direction and the colour are separate inputs, and the arrow alone
// never carries the meaning: the label always renders next to it.
type StatTone = 'good' | 'bad' | 'neutral';

const TONE: Record<StatTone, string> = {
  good: 'text-emerald-700 dark:text-emerald-400',
  bad: 'text-destructive',
  neutral: 'text-muted-foreground',
};

const ARROW = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;

type StatProps = {
  label: string;
  value: React.ReactNode;
  delta?: { label: string; direction: keyof typeof ARROW; tone?: StatTone };
  className?: string;
};

export function Stat({ label, value, delta, className }: StatProps) {
  const tone = delta?.tone ?? 'neutral';
  const Arrow = delta ? ARROW[delta.direction] : null;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <p className="text-caption font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-h3 tabular-nums">{value}</p>
      {delta && Arrow ? (
        <p className={cn('inline-flex items-center gap-1 text-small font-medium', TONE[tone])}>
          <Arrow aria-hidden className="size-3.5" />
          {delta.label}
        </p>
      ) : null}
    </div>
  );
}
