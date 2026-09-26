// The quick-access menu panel shared by the floating assistive orb and the
// header trigger (so the same Dashboard/landing navigation is reachable from
// both the orb and the menu bar). Route-aware: on dashboard routes it lists
// every workspace for one-tap navigation plus the below-the-fold sections of
// the current page; on public/marketing routes it jumps to the landing
// sections instead.
'use client';

import {
  Activity,
  Bot,
  CalendarDays,
  CircleDot,
  FireExtinguisher,
  LayoutDashboard,
  type LucideIcon,
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
import { useEffect, useRef } from 'react';
import { useIsAdmin } from '@/lib/auth-client';
import { visibleNavItems } from '@/lib/dashboard-nav';
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
// on each workspace. The quick-access menu offers these so nothing stays
// un-reachable.
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

// Public/marketing landing sections, for the menu on non-dashboard routes.
const LANDING_SECTIONS: QuickAction[] = [
  { label: 'Features', icon: Wrench, sectionId: 'toolkit' },
  { label: 'Getting started', icon: CalendarDays, sectionId: 'week' },
  { label: 'Contact', icon: PartyPopper, sectionId: 'start' },
];

function buildGroups(pathname: string, isDashboard: boolean, isAdmin: boolean): Group[] {
  if (isDashboard) {
    const groups: Group[] = [
      {
        label: 'Go to a page',
        actions: visibleNavItems(isAdmin).map((i) => ({
          label: i.label,
          icon: i.icon,
          href: i.href,
        })),
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

// Per-item icon styling, cycled across the menu so each destination gets its own
// color: vivid gradient tiles for page links, soft tinted chips for in-page
// jumps. Adds the "3D" lift + colored glow that keeps the panel from looking
// flat.
const FALLBACK_ICON_ACCENT = {
  tile: 'bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-[0_8px_16px_-8px_rgba(245,158,11,0.6)]',
  chip: 'border border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
};

const ICON_ACCENTS = [
  FALLBACK_ICON_ACCENT,
  {
    tile: 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-[0_8px_16px_-8px_rgba(16,185,129,0.6)]',
    chip: 'border border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  {
    tile: 'bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-[0_8px_16px_-8px_rgba(14,165,233,0.6)]',
    chip: 'border border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300',
  },
  {
    tile: 'bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-[0_8px_16px_-8px_rgba(139,92,246,0.6)]',
    chip: 'border border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300',
  },
];

export interface QuickAccessPanelProps {
  /** Called when the panel wants to close (close button, after a jump). */
  onClose: () => void;
}

export function QuickAccessPanel({ onClose }: QuickAccessPanelProps) {
  const pathname = usePathname();
  const isAdmin = useIsAdmin();
  const isDashboard = isPath(pathname, '/dashboard');
  const groups = buildGroups(pathname, isDashboard, isAdmin);

  // Close when the route changes (e.g. after using a page action).
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  return (
    <>
      <div className="flex items-center justify-between px-2 pb-2">
        <p className="text-sm font-semibold text-foreground">Quick access</p>
        <button
          type="button"
          aria-label="Close quick access"
          onClick={onClose}
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
          <div className="grid grid-cols-3 gap-2">
            {group.actions.map((action, index) => {
              const Icon = action.icon;
              const accent = ICON_ACCENTS[index % ICON_ACCENTS.length] ?? FALLBACK_ICON_ACCENT;
              const shared = cn(
                'group flex flex-col items-center gap-1.5 rounded-lg px-1 pb-2 pt-2.5 text-center transition-colors',
                action.href ? 'hover:bg-muted' : 'hover:bg-secondary',
              );
              const inner = (
                <>
                  <span
                    className={cn(
                      'flex size-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-110',
                      action.href ? accent.tile : accent.chip,
                    )}
                  >
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="text-[0.68rem] font-semibold leading-tight text-muted-foreground">
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
                    onClose();
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
    </>
  );
}
