// The quick-access menu panel shared by the floating assistive orb and the
// header trigger (so the same Dashboard/landing navigation is reachable from
// both the orb and the menu bar). Route-aware: on dashboard routes it lists
// every workspace for one-tap navigation plus the below-the-fold sections of
// the current page; on public/marketing routes it jumps to the landing
// sections instead.
'use client';

import {
  CalendarDays,
  CircleDot,
  FireExtinguisher,
  LayoutDashboard,
  type LucideIcon,
  Package,
  PartyPopper,
  Rocket,
  Scale,
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
      { label: 'Balance sheet', icon: Scale, sectionId: 'balance-sheet' },
      { label: 'Product ranking', icon: Trophy, sectionId: 'product-ranking' },
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
    ],
  },
  {
    match: (p) => p === '/dashboard/admin',
    actions: [{ label: 'Accounts', icon: ShieldCheck, sectionId: 'accounts-table' }],
  },
];

// Public/marketing landing sections, for the menu on non-dashboard routes.
const LANDING_SECTIONS: QuickAction[] = [
  { label: 'Features', icon: Wrench, sectionId: 'features' },
  { label: 'Showcase', icon: Store, sectionId: 'showcase' },
  { label: 'Getting started', icon: CalendarDays, sectionId: 'how-it-works' },
  { label: 'Pricing', icon: Wallet, sectionId: 'pricing' },
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
        <p className="text-small font-semibold text-foreground">Quick access</p>
        <button
          type="button"
          aria-label="Close quick access"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <CircleDot aria-hidden className="size-4" />
        </button>
      </div>
      {groups.map((group) => (
        <div key={group.label} className="mb-3 last:mb-0">
          <p className="px-2 pb-1.5 text-eyebrow">{group.label}</p>
          <div className="grid grid-cols-3 gap-2">
            {group.actions.map((action) => {
              const Icon = action.icon;
              const shared = cn(
                'group flex flex-col items-center gap-2 rounded-md px-1 pb-2 pt-2.5 text-center transition-colors hover:bg-muted',
              );
              const inner = (
                <>
                  <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="text-small font-medium leading-tight text-muted-foreground group-hover:text-foreground">
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
