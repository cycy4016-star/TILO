import * as React from 'react';

import { cn } from '@/lib/utils';

// Fields are 9px tall with a 36px text size at mobile width (so iOS doesn't
// zoom on focus), no shadow, and a border that darkens on hover so the control
// responds before you touch it. Focus is a 2px ring, not a 1px hairline.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-base text-foreground transition-colors duration-140 hover:border-[color-mix(in_oklab,var(--input),var(--foreground)_14%)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-[var(--ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 md:text-small',
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
