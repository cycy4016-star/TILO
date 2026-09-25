// Tilo app code.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { dashboardNavItems } from '@/lib/dashboard-nav';
import { cn } from '@/lib/utils';

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" className="flex flex-wrap gap-2 lg:grid">
      {dashboardNavItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-black uppercase tracking-wide transition-all',
              active
                ? '-rotate-1 bg-yellow-600 text-white shadow-[3px_3px_0_0_#451a03]'
                : 'text-stone-500 hover:bg-amber-100 hover:text-amber-900 dark:text-stone-400 dark:hover:bg-stone-800',
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
