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
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/40 px-6 py-14 text-center',
        className,
      )}
    >
      {Icon ? (
        <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon aria-hidden className="size-5" />
        </div>
      ) : null}
      <p className="font-display text-h4">{title}</p>
      {body ? <p className="max-w-[44ch] text-small text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
