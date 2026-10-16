// Shared building blocks for the ops console panels: the small presentational
// pieces and date formatters every section reuses. Client-safe.
'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function formatDay(value: string) {
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

export function PanelFallback({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/40 p-6 text-center">
      <p className="text-small font-medium text-foreground">{message}</p>
      <Button type="button" onClick={onRetry} className="h-9 rounded-md font-semibold">
        Try again
      </Button>
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="mt-3 break-words text-caption font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-display text-h3 text-foreground">{value}</p>
      {sub && <p className="mt-1 text-small text-muted-foreground">{sub}</p>}
    </article>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-md px-4 text-small font-medium ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-card text-muted-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}
