// Tilza app code.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useIsAdmin } from '@/lib/auth-client';
import { visibleNavItems } from '@/lib/dashboard-nav';
import { cn } from '@/lib/utils';

// One focus recipe for both navs. The global base rule swaps the UA outline for
// `outline-ring/50`, which is a 1px hairline — invisible against a muted fill.
// A 2px ring with an offset is the difference between "keyboard works" and
// "keyboard appears to do nothing".
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function DashboardNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const isAdmin = useIsAdmin();

  if (mobile) {
    return (
      <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibleNavItems(isAdmin).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-small font-medium transition-colors',
                FOCUS,
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <nav aria-label="Dashboard" className="flex flex-wrap gap-1 lg:grid lg:gap-0.5">
      {visibleNavItems(isAdmin).map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-small font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              FOCUS,
              active &&
                // The rail sits in the container's left gutter (px-6 at lg), so
                // it never reaches the clipped edge of <main>. It is the single
                // clearest "you are here" signal a sidebar can carry.
                'bg-muted font-semibold text-foreground hover:bg-muted before:absolute before:-left-3 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:content-[""]',
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
