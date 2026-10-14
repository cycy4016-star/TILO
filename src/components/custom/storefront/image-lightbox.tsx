// Fullscreen "tap to view" photo viewer for the storefront.
//
// The catalogue grid and quick-view sheet crop photos to a tidy square; this
// overlay is where a shopper actually inspects the product — the whole image,
// uncropped (object-contain), on a near-black backdrop. Tap the backdrop or the
// close button to dismiss. Built on the Radix dialog primitive so focus-trap,
// Escape-to-close and scroll-lock come for free, and it portals itself out of
// the themed <main> (the backdrop is deliberately theme-agnostic).
'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import Image from 'next/image';

export function ImageLightbox({
  open,
  onOpenChange,
  src,
  alt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  alt: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onClick={(event) => {
            if (event.target === event.currentTarget) onOpenChange(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          {src && (
            <div className="relative h-[86vh] w-full max-w-5xl">
              <Image src={src} alt={alt} fill sizes="100vw" className="object-contain" priority />
            </div>
          )}
          <DialogPrimitive.Close
            aria-label="Close image"
            className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            <X aria-hidden className="size-5" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
