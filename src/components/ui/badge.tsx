import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/lib/utils';

// Status chips. The dashboard is full of them — order states, incident states,
// feedback states — and shipping four ad-hoc colour recipes across five
// workspaces is exactly how a product stops looking designed.
//
// These deliberately use the RAW palette rather than the derived --brand ramp:
// success must read green and danger red whatever hue the shop has picked.
// Tints (colour at ~12% over transparent) keep them quiet enough to repeat
// down a table column without shouting.
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/80',
        outline: 'text-foreground',
        success: 'border-transparent bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
        warning: 'border-transparent bg-amber-500/12 text-amber-700 dark:text-amber-400',
        info: 'border-transparent bg-sky-500/12 text-sky-700 dark:text-sky-400',
        neutral: 'border-transparent bg-muted text-muted-foreground',
      },
      // A status dot before the label. Linear's status chips read this way and
      // it lets a screen-reader-scanned table stay legible at a glance.
      dot: {
        true: '',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      dot: false,
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, dot }), className)} {...props}>
      {dot ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
