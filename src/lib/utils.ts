// shadcn standard cn() helper. Every shadcn primitive imports this.
//
// tailwind-merge is configured below rather than used bare: its default config
// only knows the built-in `text-*` utilities, so it would fail to recognise the
// project's type-scale tokens (text-display, text-h1 … text-caption from
// src/app/globals.css) as font SIZES. Unrecognised classes don't conflict, so
// `cn(buttonVariants(...), className)` would leave BOTH `text-sm` (from the
// primitive) and `text-small` (from the caller) in the class list, and the
// generated CSS source order — not the caller — would decide which wins.
// Registering them as fontSize makes the caller's token correctly override the
// primitive's, which is the entire contract of cn().

import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // The object key is the `text-` prefix; the values are the suffixes.
      // Registered in the `font-size` group so these tokens conflict with
      // `text-sm`/`text-xs` the way real font sizes do.
      'font-size': [
        {
          text: ['display', 'h1', 'h2', 'h3', 'h4', 'body-lg', 'body', 'small', 'caption'],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
