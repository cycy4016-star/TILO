// The TILO mark: a yellow flame badge — the brand at a glance. Used in the
// site header, the dashboard shell, and on the auth cards. Dark flame on a
// yellow gradient tile, with a soft gloss so it reads as a proper logo rather
// than a flat icon chip.
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
        'relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-600 text-[#422006] shadow-[0_6px_14px_-6px_rgba(202,138,4,0.6)]',
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/45 to-transparent"
      />
      <Flame fill="currentColor" aria-hidden className={cn('size-5', iconClassName)} />
    </span>
  );
}
