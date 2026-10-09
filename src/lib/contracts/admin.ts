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

// Platform ops center: cross-shop totals for the operator's Splunk-style
// monitor. Every number is computed from live rows — no samples, no seeds.
export const AdminOverviewDay = z.object({
  day: z.string(),
  signups: z.number().int().nonnegative(),
  orders: z.number().int().nonnegative(),
});

export const AdminOverview = z.object({
  users: z.number().int().nonnegative(),
  signupsMonth: z.number().int().nonnegative(),
  stores: z.number().int().nonnegative(),
  activeStores: z.number().int().nonnegative(),
  items: z.number().int().nonnegative(),
  customers: z.number().int().nonnegative(),
  orders: z.number().int().nonnegative(),
  ordersToday: z.number().int().nonnegative(),
  unpaidOrders: z.number().int().nonnegative(),
  gmvPesewas: z.number().int().nonnegative(),
  paidPesewas: z.number().int().nonnegative(),
  ordersByStatus: z.record(z.string(), z.number().int().nonnegative()),
  smsSentMonth: z.number().int().nonnegative(),
  smsFailedMonth: z.number().int().nonnegative(),
  smsCreditsMonth: z.number().int().nonnegative(),
  paymentsPending: z.number().int().nonnegative(),
  paymentsSuccess: z.number().int().nonnegative(),
  paymentsFailed: z.number().int().nonnegative(),
  // Oldest-first, one entry per day for the trailing 14 days.
  daily: z.array(AdminOverviewDay),
});

export type AdminOverviewDay = z.infer<typeof AdminOverviewDay>;
export type AdminOverview = z.infer<typeof AdminOverview>;

// One row per shop for the operator's shop table. Counts come from the live
// catalogue + order rows owned by that shop's account.
export const AdminShopRow = z.object({
  userId: z.string(),
  ownerName: z.string(),
  ownerPhone: z.string().nullable(),
  storeName: z.string().nullable(),
  slug: z.string().nullable(),
  storeActive: z.boolean().nullable(),
  itemCount: z.number().int().nonnegative(),
  customerCount: z.number().int().nonnegative(),
  orderCount: z.number().int().nonnegative(),
  unpaidCount: z.number().int().nonnegative(),
  gmvPesewas: z.number().int().nonnegative(),
  lastOrderAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const AdminShops = z.object({
  shops: z.array(AdminShopRow),
  total: z.number().int().nonnegative(),
});

export type AdminShopRow = z.infer<typeof AdminShopRow>;
export type AdminShops = z.infer<typeof AdminShops>;

// One normalized event for the operator's search feed. Sources are the live
// order, SMS-ledger, payment and signup rows — the closest thing the app has
// to a Splunk event stream.
export const OpsEventKind = z.enum(['order', 'sms', 'payment', 'signup', 'store']);

export const OpsEvent = z.object({
  id: z.string(),
  ts: z.string().datetime(),
  kind: OpsEventKind,
  shop: z.string().nullable(),
  summary: z.string(),
  detail: z.string().nullable(),
  ok: z.boolean().nullable(),
});

export const OpsEvents = z.object({
  events: z.array(OpsEvent),
  total: z.number().int().nonnegative(),
});

export type OpsEventKind = z.infer<typeof OpsEventKind>;
export type OpsEvent = z.infer<typeof OpsEvent>;
export type OpsEvents = z.infer<typeof OpsEvents>;

// Full dossier on one account for the operator: identity, storefront, live
// counts, top items by revenue, and the most recent orders, customers and
// SMS rows filed under that account.
export const AdminDossierOrder = z.object({
  id: z.string(),
  orderNumber: z.string(),
  description: z.string(),
  status: z.string(),
  amountPesewas: z.number().int().nullable(),
  paidAt: z.string().datetime().nullable(),
  customerName: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const AdminDossierItem = z.object({
  name: z.string(),
  units: z.number().int().nonnegative(),
  revenuePesewas: z.number().int().nonnegative(),
});

export const AdminDossierCustomer = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  orderCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export const AdminDossierSms = z.object({
  id: z.string(),
  to: z.string(),
  source: z.string(),
  ok: z.boolean(),
  credits: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export const AdminShopDetail = z.object({
  userId: z.string(),
  ownerName: z.string(),
  ownerEmail: z.string(),
  ownerPhone: z.string().nullable(),
  phoneVerified: z.boolean().nullable(),
  role: z.string().nullable(),
  banned: z.boolean(),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime().nullable(),
  storeName: z.string().nullable(),
  slug: z.string().nullable(),
  storeActive: z.boolean().nullable(),
  itemCount: z.number().int().nonnegative(),
  customerCount: z.number().int().nonnegative(),
  orderCount: z.number().int().nonnegative(),
  gmvPesewas: z.number().int().nonnegative(),
  paidPesewas: z.number().int().nonnegative(),
  topItems: z.array(AdminDossierItem),
  recentOrders: z.array(AdminDossierOrder),
  recentCustomers: z.array(AdminDossierCustomer),
  recentSms: z.array(AdminDossierSms),
});

export type AdminShopDetail = z.infer<typeof AdminShopDetail>;

// Platform product intelligence: every item's buy rate across all shops —
// units per day between its first and last sale — plus revenue, margin and
// freshness, ranked fastest-first. Built from the live order-line snapshots.
export const AdminProductRow = z.object({
  name: z.string(),
  shop: z.string().nullable(),
  slug: z.string().nullable(),
  units: z.number().int().nonnegative(),
  orderCount: z.number().int().nonnegative(),
  revenuePesewas: z.number().int().nonnegative(),
  profitPesewas: z.number().int().nonnegative(),
  marginPercent: z.number().int().nullable(),
  // Units sold per calendar day from first to last sale (min 1 day).
  unitsPerDay: z.number().nonnegative(),
  daysActive: z.number().int().nonnegative(),
  lastSoldAt: z.string().datetime().nullable(),
  stock: z.number().int().nullable(),
  active: z.boolean().nullable(),
});

export const AdminProducts = z.object({
  items: z.array(AdminProductRow),
  totalUnits: z.number().int().nonnegative(),
  totalRevenuePesewas: z.number().int().nonnegative(),
  outOfStock: z.number().int().nonnegative(),
  lowStock: z.number().int().nonnegative(),
});

export type AdminProductRow = z.infer<typeof AdminProductRow>;
export type AdminProducts = z.infer<typeof AdminProducts>;
