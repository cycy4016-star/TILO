// Dashboard navigation shared by the pinned sidebar (DashboardNav), the
// Assistive Touch quick-access ball, and anything else that needs the app's
// top-level page list. One source of truth so the sidebar and the ball never
// drift apart. Client-safe: consumers are client components.
import {
  Bot,
  BrainCircuit,
  FireExtinguisher,
  LayoutDashboard,
  type LucideIcon,
  Package,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Platform-admin only. Hides the entry from ordinary shop owners; the page
   * itself re-checks with requireAdmin(), so this is presentation, not the
   * security boundary.
   */
  adminOnly?: boolean;
};

const allNavItems: DashboardNavItem[] = [
  { href: '/dashboard', label: 'Pulse', icon: LayoutDashboard },
  { href: '/dashboard/orders', label: 'Orders', icon: FireExtinguisher },
  { href: '/dashboard/customers', label: 'People', icon: Users },
  { href: '/dashboard/store', label: 'Store', icon: Store },
  { href: '/dashboard/products', label: 'Products', icon: Package },
  { href: '/dashboard/intelligence', label: 'Intelligence', icon: BrainCircuit },
  { href: '/dashboard/automations', label: 'Switchboard', icon: Bot },
  { href: '/dashboard/admin', label: 'Admin', icon: ShieldCheck, adminOnly: true },
];

/**
 * The nav a given account should see. Every item is a page inside that person's
 * OWN shop, so they are all shown to any signed-in user — the account monitor is
 * the exception, since it reads across accounts.
 *
 * @param isAdmin result of useIsAdmin() — the platform `admin` role.
 */
export function visibleNavItems(isAdmin: boolean): DashboardNavItem[] {
  return allNavItems.filter((item) => !item.adminOnly || isAdmin);
}
