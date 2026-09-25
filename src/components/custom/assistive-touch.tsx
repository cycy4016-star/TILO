// Assistive Touch — the floating round quick-access orb (Think: the iOS ball).
// Always mounted (via GlobalMounts). Renders a small orb pinned to the bottom
// right; tapping it pops the quick-access panel (see assistive-menu.tsx): every
// dashboard page for one-tap navigation, plus in-page jump links. The orb is a
// 3D floating button with a breathing pulse ring and a hover tooltip so it
// reads as a menu. The same panel is also reachable from the header via
// dashboard-shell, which reuses assistive-menu.tsx.
'use client';

import { Menu } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { QuickAccessPanel } from './assistive-menu';

export function AssistiveTouch() {
  const [open, setOpen] = React.useState(false);

  // Close on Escape.
  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)_+_1.25rem)] right-[calc(env(safe-area-inset-right)_+_1.25rem)] z-40">
      {open && (
        <div className="mb-3 w-64 origin-bottom-right rounded-xl border border-border bg-card p-3 shadow-xl">
          <QuickAccessPanel onClose={() => setOpen(false)} />
        </div>
      )}

      <button
        type="button"
        aria-label={open ? 'Close quick access' : 'Open quick access'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'group relative flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 via-emerald-600 to-sky-700 text-white shadow-[0_10px_28px_-8px_rgba(6,95,70,0.55)] ring-4 ring-background transition-transform duration-300 ease-out motion-safe:animate-tilo-float hover:scale-110 active:scale-95',
          open && 'scale-110',
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-emerald-400/40 motion-safe:animate-tilo-ping"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/30 to-transparent"
        />
        <span
          className={cn(
            'pointer-events-none absolute right-full mr-2 hidden items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 md:flex',
            open && 'opacity-100',
          )}
        >
          <Menu aria-hidden className="size-3.5" />
          Menu
        </span>
        <Menu
          aria-hidden
          className="size-6 transition-transform duration-300 group-hover:rotate-90"
        />
      </button>
    </div>
  );
}
