import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

// Three things separate a funded-product button from a template one:
//   1. A real FOCUS ring — 2px with an offset, so keyboard users can actually
//      see where they are.
//   2. A PRESSED state — the fill deepens by one step instead of scaling. Scale
//      on press is a toy tell; a darker fill is what a real control does.
//   3. NO elevation. Filled buttons are flat: the colour is the hierarchy. Only
//      floating surfaces (menus, dialogs, toasts) get a shadow in this system.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-small font-medium transition-colors duration-140 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary),#000_12%)] active:bg-[color-mix(in_oklab,var(--primary),#000_18%)]',
        destructive:
          'bg-destructive text-white hover:bg-[color-mix(in_oklab,var(--destructive),#000_12%)] active:bg-[color-mix(in_oklab,var(--destructive),#000_18%)]',
        outline:
          'border border-border bg-card text-foreground hover:bg-accent hover:border-[color-mix(in_oklab,var(--foreground),transparent_80%)]',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklab,var(--secondary),var(--foreground)_6%)]',
        ghost: 'text-secondary-foreground hover:bg-accent hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 px-3 text-caption',
        lg: 'h-10 px-5',
        // Marketing CTAs only. Dashboard controls stay at the default height —
        // an oversized button inside a dense toolbar reads as a bug.
        xl: 'h-11 px-6 text-body-lg',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
