// Deep-linkable section nav for the ops console. Unlike the old in-page tab
// state, every section is a real route — bookmarkable, refresh-safe and
// shareable, so an operator can send a teammate a direct link to the ledger.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const CONSOLE_SECTIONS = [
  { href: '/dashboard/admin', label: 'Overview' },
  { href: '/dashboard/admin/shops', label: 'Shops' },
  { href: '/dashboard/admin/users', label: 'Accounts' },
  { href: '/dashboard/admin/products', label: 'Products' },
  { href: '/dashboard/admin/events', label: 'Events' },
  { href: '/dashboard/admin/health', label: 'Health' },
  { href: '/dashboard/admin/feedback', label: 'Feedback' },
] as const;

export function ConsoleNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Console sections"
      className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0"
    >
      <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CONSOLE_SECTIONS.map((entry) => {
          // The Overview link is the only exact match; every other entry
          // highlights on its own section and its children (e.g. a shop dossier).
          const active =
            entry.href === '/dashboard/admin'
              ? pathname === entry.href
              : pathname === entry.href || pathname.startsWith(`${entry.href}/`);
          return (
            <Link
              key={entry.href}
              href={entry.href}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-small font-medium transition-colors ${
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {entry.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
