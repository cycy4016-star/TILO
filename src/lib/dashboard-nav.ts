// Dashboard navigation shared by the pinned sidebar (DashboardNav), the
// Assistive Touch quick-access ball, and anything else that needs the app's
// top-level page list. One source of truth so the sidebar and the ball never
// drift apart. Client-safe: consumers are client components.
//
// There are two workspaces and they never mix. A shop owner gets the merchant
// list — every page inside their OWN shop. A platform operator owns no shop,
// so the merchant list is dead weight for them: their entire workspace is the
// cross-account console.
import {
  FireExtinguisher,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const merchantNavItems: DashboardNavItem[] = [
  { href: '/dashboard', label: 'Analytics', icon: LayoutDashboard },
  { href: '/dashboard/store', label: 'Catalogue', icon: Store },
  { href: '/dashboard/orders', label: 'Orders', icon: FireExtinguisher },
  { href: '/dashboard/customers', label: 'Customers', icon: Users },
  // Socials are optional at onboarding, so Settings is where a skipped step
  // gets filled in later — it lives in the nav, not buried in the manager.
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const operatorNavItems: DashboardNavItem[] = [
  { href: '/dashboard/admin', label: 'Console', icon: ShieldCheck },
];

/**
 * The nav a given account should see. Shop owners get their own shop; a
 * platform operator gets the ops console and nothing else. Presentation only —
 * each page still re-checks the role with requireAdmin() / requireAuth().
 *
 * @param isAdmin result of useIsAdmin() — the platform `admin` role.
 */
export function visibleNavItems(isAdmin: boolean): DashboardNavItem[] {
  return isAdmin ? operatorNavItems : merchantNavItems;
}
