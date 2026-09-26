// Single source of truth for "is this account a platform admin?".
//
// `role` is a PLATFORM role, not a per-shop one: sign-ups get "user" and only
// the account matching ADMIN_PHONE / ADMIN_EMAIL is promoted to "admin" (see
// resolveRole in src/lib/auth.ts). It grants exactly one thing — reading the
// cross-account admin monitor. Per-shop access is enforced by the `userId`
// ownership columns on every business row, not by a role check.
//
// The role is stored as a bare string (better-auth's admin plugin column), so it
// is compared defensively: a comma-separated list counts as admin when any part
// matches, mirroring how the plugin itself resolves roles.

export const ADMIN_ROLE = 'admin';

/** True when a `user.role` value grants platform-admin rights. */
export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return role
    .split(',')
    .map((part) => part.trim())
    .includes(ADMIN_ROLE);
}
