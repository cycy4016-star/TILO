// The brand mark in the dashboard header.
//
// This used to be a colour picker — a popover of nine presets that rewrote
// <html data-theme> and persisted a per-account choice. Tilza has one look now,
// so there is nothing to pick and the whole affordance is gone.
//
// What remains is a static, non-interactive mark showing the platform's two
// colours side by side: blue (structure) and orange (energy). It is not a
// button, it has no role, and it is hidden from assistive tech — it is
// decoration confirming which look the workspace is in.
//
// WHEN THE LOGO ARRIVES: drop it in /public and set `brandLogo` in
// src/lib/brand.ts, and TilzaLogo renders it everywhere. This component is
// replaced by (or reduced to) a TilzaLogo at the same call site.
'use client';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      title="Tilza"
      className={
        className ??
        'inline-flex size-9 shrink-0 items-center justify-center gap-0.5 rounded-md border border-border bg-background'
      }
    >
      <span className="block h-4 w-1.5 rounded-full bg-primary" />
      <span className="block h-4 w-1.5 rounded-full bg-highlight" />
    </span>
  );
}
