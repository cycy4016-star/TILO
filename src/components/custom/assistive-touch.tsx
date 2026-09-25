// Assistive Touch — the floating round quick-access orb (Think: the iOS ball).
// Always mounted (via GlobalMounts). Renders a small orb pinned to the bottom
// right; tapping it pops a panel of quick-access icons: every dashboard page
// for one-tap navigation, plus in-page jump links straight to the below-the-fold
// sections of the current workspace. Route-aware: on public/marketing pages it
// jumps to the landing sections instead.
'use client';

import {
  Activity,
  Bot,
  CalendarDays,
  CircleDot,
  FireExtinguisher,
  LayoutDashboard,
  type LucideIcon,
  Menu,
  Package,
  PartyPopper,
  Rocket,
  ScrollText,
  ShieldCheck,
  Store,
  Tag,
  Trophy,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { dashboardNavItems } from '@/lib/dashboard-nav';
import { cn } from '@/lib/utils';

type QuickAction = {
  label: string;
  icon: LucideIcon;
  href?: string;
  /** In-page section to scroll to (same route). */
  sectionId?: string;
};

type Group = {
  label: string;
  actions: QuickAction[];
};

function isPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

// Below-the-fold sections per dashboard route, keyed by the section ids stamped
// on each workspace. The ball offers these so nothing stays un-reachable.
const DASHBOARD_SECTIONS: { match: (p: string) => boolean; actions: QuickAction[] }[] = [
  {
    match: (p) => p === '/dashboard',
    actions: [
      { label: 'Money to chase', icon: Wallet, sectionId: 'money-to-chase' },
      { label: 'SMS usage', icon: Activity, sectionId: 'sms-usage' },
      { label: 'Quick links', icon: Rocket, sectionId: 'jump-pads' },
    ],
  },
  {
    match: (p) => isPath(p, '/dashboard/orders'),
    actions: [{ label: 'Order queue', icon: FireExtinguisher, sectionId: 'orders-queue' }],
  },
  {
    match: (p) => p === '/dashboard/customers',
    actions: [{ label: 'Directory', icon: Users, sectionId: 'customers-directory' }],
  },
  {
    match: (p) => isPath(p, '/dashboard/customers/'),
    actions: [
      { label: 'Timeline', icon: FireExtinguisher, sectionId: 'customer-timeline' },
      { label: 'New order', icon: Rocket, sectionId: 'fresh-order' },
    ],
  },
  {
    match: (p) => p === '/dashboard/store',
    actions: [
      { label: 'Store details', icon: Store, sectionId: 'store-details' },
      { label: 'Catalogue', icon: Package, sectionId: 'the-shelf' },
      { label: 'Sales & promotions', icon: Tag, sectionId: 'sales-and-promos' },
      { label: 'Post history', icon: ScrollText, sectionId: 'publish-log' },
    ],
  },
  {
    match: (p) => p === '/dashboard/products',
    actions: [{ label: 'Ranking', icon: Trophy, sectionId: 'ranking-table' }],
  },
  {
    match: (p) => p === '/dashboard/intelligence',
    actions: [{ label: 'Biggest earners', icon: Trophy, sectionId: 'biggest-earners' }],
  },
  {
    match: (p) => p === '/dashboard/automations',
    actions: [
      { label: 'Rules', icon: Bot, sectionId: 'switchboard-rules' },
      { label: 'Recent activity', icon: Activity, sectionId: 'recent-activity' },
    ],
  },
  {
    match: (p) => p === '/dashboard/admin',
    actions: [{ label: 'Accounts', icon: ShieldCheck, sectionId: 'accounts-table' }],
  },
];

// Public/marketing landing sections, for the ball on non-dashboard routes.
const LANDING_SECTIONS: QuickAction[] = [
  { label: 'Features', icon: Wrench, sectionId: 'toolkit' },
  { label: 'Getting started', icon: CalendarDays, sectionId: 'week' },
  { label: 'Contact', icon: PartyPopper, sectionId: 'start' },
];

function buildGroups(pathname: string, isDashboard: boolean): Group[] {
  if (isDashboard) {
    const groups: Group[] = [
      {
        label: 'Go to a page',
        actions: dashboardNavItems.map((i) => ({ label: i.label, icon: i.icon, href: i.href })),
      },
    ];
    const sections = DASHBOARD_SECTIONS.find((s) => s.match(pathname))?.actions;
    if (sections && sections.length > 0) {
      groups.push({ label: 'Jump to a section', actions: sections });
    }
    return groups;
  }
  return [
    { label: 'Jump to a section', actions: LANDING_SECTIONS },
    {
      label: 'Account',
      actions: [{ label: 'Workspace', icon: LayoutDashboard, href: '/dashboard' }],
    },
  ];
}

export function AssistiveTouch() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const isDashboard = isPath(pathname, '/dashboard');
  const groups = buildGroups(pathname, isDashboard);

  // Close when the route changes (e.g. after using a page action).
  const lastPath = React.useRef(pathname);
  React.useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  // Close on Escape.
  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)_+_1.25rem)] right-[calc(env(safe-area-inset-right)_+_1.25rem)] z-40">
      {open && (
        <div className="mb-3 w-64 origin-bottom-right rounded-xl border border-border bg-card p-3 shadow-xl">
          <div className="flex items-center justify-between px-2 pb-2">
            <p className="text-sm font-semibold text-foreground">Quick access</p>
            <button
              type="button"
              aria-label="Close quick access"
              onClick={() => setOpen(false)}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CircleDot aria-hidden className="size-4" />
            </button>
          </div>
          {groups.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <p className="px-2 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {group.actions.map((action) => {
                  const Icon = action.icon;
                  const shared = cn(
                    'group flex flex-col items-center gap-1 rounded-lg px-1 pb-2 pt-2.5 text-center transition-colors',
                    action.href ? 'hover:bg-muted' : 'hover:bg-secondary',
                  );
                  const inner = (
                    <>
                      <span
                        className={cn(
                          'flex size-9 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
                          action.href
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground',
                        )}
                      >
                        <Icon aria-hidden className="size-4" />
                      </span>
                      <span className="text-[0.6rem] font-semibold leading-tight text-muted-foreground">
                        {action.label}
                      </span>
                    </>
                  );
                  if (action.href) {
                    return (
                      <Link key={action.label} href={action.href} className={shared}>
                        {inner}
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={action.label}
                      type="button"
                      className={shared}
                      onClick={() => {
                        setOpen(false);
                        document.getElementById(action.sectionId ?? '')?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        });
                      }}
                    >
                      {inner}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        aria-label={open ? 'Close quick access' : 'Open quick access'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'group relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform hover:scale-110 active:scale-95',
          open && 'scale-110',
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-primary/40 motion-safe:animate-tilo-ping"
        />
        <span
          className={cn(
            'pointer-events-none absolute right-full mr-2 hidden items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 md:flex',
            open && 'opacity-100',
          )}
        >
          <Menu aria-hidden className="size-3.5" />
          Menu
        </span>
        <Menu
          aria-hidden
          className="size-6 transition-transform duration-300 group-hover:rotate-90"
        />
      </button>
    </div>
  );
}
