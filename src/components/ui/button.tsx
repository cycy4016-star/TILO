import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

// Marketplace buttons: generous targets, bold labels, a real focus ring and a
// pressed state that deepens the fill. Filled buttons stay flat — colour is the
// hierarchy; only floating surfaces carry a shadow.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-small font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary),#000_12%)] active:bg-[color-mix(in_oklab,var(--primary),#000_18%)]',
        highlight:
          'bg-highlight text-highlight-foreground hover:bg-[color-mix(in_oklab,var(--highlight),#000_10%)] active:bg-[color-mix(in_oklab,var(--highlight),#000_16%)]',
        destructive:
          'bg-destructive text-white hover:bg-[color-mix(in_oklab,var(--destructive),#000_12%)] active:bg-[color-mix(in_oklab,var(--destructive),#000_18%)]',
        outline:
          'border border-border bg-card text-foreground hover:border-[color-mix(in_oklab,var(--primary),transparent_55%)] hover:text-primary',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklab,var(--secondary),var(--foreground)_6%)]',
        ghost: 'text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-9 px-3 text-small',
        lg: 'h-11 px-5',
        // Marketing CTAs only. Dashboard controls stay at the default height.
        xl: 'h-12 px-7 text-body',
        icon: 'size-10',
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
