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
  good: 'text-emerald-700',
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

// The value is the loudest thing in the tile and it is set in the mono face at
// a tabular size so a row of metrics scans as a row of numbers. The label is
// plain small secondary ink — uppercase-tracked labels turn a metric row into a
// poster, and the eye stops being able to find the figure.
export function Stat({ label, value, delta, className }: StatProps) {
  const tone = delta?.tone ?? 'neutral';
  const Arrow = delta ? ARROW[delta.direction] : null;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-h4 font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
      {delta && Arrow ? (
        <p className={cn('inline-flex items-center gap-1 text-caption font-medium', TONE[tone])}>
          <Arrow aria-hidden className="size-3.5" />
          {delta.label}
        </p>
      ) : null}
    </div>
  );
}
