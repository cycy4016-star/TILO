// Tilo app code.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useIsAdmin } from '@/lib/auth-client';
import { visibleNavItems } from '@/lib/dashboard-nav';
import { cn } from '@/lib/utils';

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
              'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-small font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              active && 'bg-accent font-semibold text-foreground hover:bg-accent',
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
