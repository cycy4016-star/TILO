import * as React from 'react';

import { cn } from '@/lib/utils';

// 40px fields, 16px text at mobile width so iOS never zooms on focus, and a
// border that warms on hover. Focus is a real 2px ring.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-card px-3 py-1 text-base text-foreground transition-colors duration-150 hover:border-[color-mix(in_oklab,var(--input),var(--foreground)_14%)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-[var(--ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 md:text-small',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
