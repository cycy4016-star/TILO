// The Tilza Terminal route group. It exists for one reason: to lift the console
// out of the shop dashboard's chrome (site nav, footer, 6xl column, sidebar)
// without changing its URL. The terminal is a full-viewport working surface —
// everything it needs is inside TerminalShell — so this layout is a bare pass-
// through. Authorization lives in dashboard/admin/layout.tsx.
import type { ReactNode } from 'react';

export default function TerminalLayout({ children }: { children: ReactNode }) {
  // Matches the terminal's own --t-bg (custom-style.css): the wrapper can show
  // through on overscroll, so it sits in the same light console blue-grey.
  return <div className="min-h-dvh bg-[#f4f6fb]">{children}</div>;
}
