import type { LucideIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

// Designed empty state. Every list, table and chart in the workspace hits a
// zero row at some point, and the default — a bare "No results" — is the
// fastest way to make a product feel unfinished. The recipe here is the one
// Linear and Stripe both use: a quiet icon, a human title, ONE line of
// explanation, and the single action that fills the void.
type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  /** One sentence. Say what will appear here, not that the list is empty. */
  body?: string;
  /** The action that fills the void. Omit when there is nothing to do. */
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2.5 rounded-xl border border-border bg-card px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
          <Icon aria-hidden className="size-4" />
        </div>
      ) : null}
      <p className="text-body font-semibold text-foreground">{title}</p>
      {body ? (
        <p className="max-w-[44ch] text-small leading-relaxed text-muted-foreground">{body}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
