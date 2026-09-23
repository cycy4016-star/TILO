// Client-safe Admin monitor contract shared by the route and the island: a
// living list of every Tilo account with their sign-in pulse.
import { z } from 'zod';

export const AdminUserRow = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  role: z.string().nullable(),
  banned: z.boolean(),
  // Number of sessions that account has started (a rough "logins" gauge).
  sessionCount: z.number().int().nonnegative(),
  // CreatedAt of the account's most recent session.
  lastSeenAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const AdminUserMonitor = z.object({
  users: z.array(AdminUserRow),
  totalUsers: z.number().int().nonnegative(),
  adminCount: z.number().int().nonnegative(),
  activeThisMonth: z.number().int().nonnegative(),
});

export type AdminUserRow = z.infer<typeof AdminUserRow>;
export type AdminUserMonitor = z.infer<typeof AdminUserMonitor>;
