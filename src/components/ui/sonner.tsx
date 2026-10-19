'use client';

import type * as React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

// Global toast host mounted once in the layout providers slot. The theme is
// pinned to 'light' rather than read from a provider: Tilza has one canvas, so
// there is nothing to follow and nothing that can desync after hydration.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
