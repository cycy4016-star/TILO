// The brand mark in the dashboard header.
//
// This used to be a colour picker — a popover of nine presets that rewrote
// <html data-theme> and persisted a per-account choice. Tilza has one look now,
// so there is nothing to pick and the whole affordance is gone.
//
// What remains is a static, non-interactive bag mark. It is not a button, it
// has no role, and it is hidden from assistive tech — it is decoration
// confirming which look the workspace is in.
'use client';

import { brandMark } from '@/lib/brand';

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
      {/* biome-ignore lint/performance/noImgElement: tiny static brand mark. */}
      <img src={brandMark} alt="" className="size-5 object-contain" />
    </span>
  );
}
