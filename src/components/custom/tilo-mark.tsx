// The TILO mark: a restrained corporate badge — the brand at a glance. Used in
// the site header, the dashboard shell, and on the auth cards. A flat primary
// tile that follows the active theme (slate by default), so the mark stays
// quiet on every surface instead of shouting in yellow.
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TiloMarkProps {
  className?: string;
  iconClassName?: string;
}

export function TiloMark({ className, iconClassName }: TiloMarkProps) {
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm',
        className,
      )}
    >
      <Flame fill="currentColor" aria-hidden className={cn('size-5', iconClassName)} />
    </span>
  );
}
