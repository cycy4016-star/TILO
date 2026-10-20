import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/lib/utils';

// Status chips. The dashboard is full of them — order states, incident states,
// feedback states — and shipping four ad-hoc colour recipes across five
// workspaces is exactly how a product stops looking designed.
//
// These deliberately use the RAW palette rather than the derived --brand ramp:
// success must read green and danger red whatever hue the shop has picked.
// The shape is a small rounded rect, not a pill: chips sit in table cells and
// filter rows, where a pill starts to look like a button. Weight is medium, not
// semibold — a chip is a label, and a label at 600 in a column of numbers reads
// like an alert.
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-caption font-semibold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        sale: 'border-transparent bg-highlight text-highlight-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-white',
        outline: 'border-border bg-card text-secondary-foreground',
        success: 'border-[#b7e4c7] bg-[#eaf7ef] text-[#17663a]',
        warning: 'border-[#f3d9a6] bg-[#fdf6e6] text-[#8a5a12]',
        info: 'border-[#ffd9bd] bg-[#fff4ea] text-[#a63d00]',
        neutral: 'border-transparent bg-secondary text-muted-foreground',
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
