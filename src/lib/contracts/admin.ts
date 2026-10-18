// Client-safe Admin monitor contract shared by the route and the island: a
// living list of every Tilza account with their sign-in pulse.
import { z } from 'zod';

export const AdminUserRow = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  role: z.string().nullable(),
  banned: z.boolean(),
  // Sign-ins recorded on the append-only auth-event ledger. Unlike the old
  // session-derived count, this never shrinks when a user logs out or their
  // session expires.
  signInCount: z.number().int().nonnegative(),
  // Timestamp of the account's most recent SIGNIN entry on the ledger.
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
  // Items first listed on the catalogue that day.
  items: z.number().int().nonnegative(),
  // Lead-form captures (Customer.source = LEAD) that day — the inquiry rate.
  inquiries: z.number().int().nonnegative(),
  // Incidents whose FIRST sighting fell that day. AppLog rows fold repeats, so
  // this is "new bugs per day", not "failures per day" — occurrences live in
  // AdminOverview.errorOccurrences.
  errors: z.number().int().nonnegative(),
});

export const AdminOverview = z.object({
  users: z.number().int().nonnegative(),
  signupsMonth: z.number().int().nonnegative(),
  // Sign-ins on the permanent ledger — today and since the month began. These
  // survive logout/expiry because they come from auth_event, not session.
  signInsToday: z.number().int().nonnegative(),
  signInsMonth: z.number().int().nonnegative(),
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
  // ── catalogue growth ──
  itemsAddedMonth: z.number().int().nonnegative(),
  // ── inquiry tracking ──
  // Distinct people who ever used the storefront lead form.
  leads: z.number().int().nonnegative(),
  leadsMonth: z.number().int().nonnegative(),
  // Every lead-form submission, repeats included (sum of Customer.inquiryCount).
  inquiries: z.number().int().nonnegative(),
  // ── error ledger ──
  // Incidents still marked unresolved.
  errorsOpen: z.number().int().nonnegative(),
  // Total times any failure fired, repeats folded away.
  errorOccurrences: z.number().int().nonnegative(),
  // ── feedback ──
  feedbackTotal: z.number().int().nonnegative(),
  feedbackNew: z.number().int().nonnegative(),
  // Oldest-first, one entry per day for the trailing window (7, 14 or 30).
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
// order, SMS-ledger, payment, signup, sign-in, shop-opening, lead-capture,
// incident and feedback rows — the closest thing the app has to a Splunk
// event stream.
export const OpsEventKind = z.enum([
  'order',
  'sms',
  'payment',
  'signup',
  'signin',
  'lead',
  'store',
  'error',
  'feedback',
]);

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

// ── error ledger ────────────────────────────────────────────────────────────
// One row per GROUPED incident (see prisma/schema/telemetry.prisma). This is
// the operator's answer to "I don't want to read error codes": a message a
// human wrote, a repeat count, and the last time it fired.
export const AdminLogLevel = z.enum(['ERROR', 'WARN', 'INFO']);
export const AdminLogSource = z.enum(['SERVER', 'CLIENT']);

export const AdminLogRow = z.object({
  id: z.string(),
  // Stable grouping key — two rows never share one.
  fingerprint: z.string(),
  level: AdminLogLevel,
  source: AdminLogSource,
  message: z.string(),
  summary: z.string().nullable(),
  route: z.string().nullable(),
  method: z.string().nullable(),
  status: z.number().int().nullable(),
  digest: z.string().nullable(),
  stack: z.string().nullable(),
  userId: z.string().nullable(),
  url: z.string().nullable(),
  count: z.number().int().nonnegative(),
  resolved: z.boolean(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});

export const AdminLogs = z.object({
  items: z.array(AdminLogRow),
  total: z.number().int().nonnegative(),
  // Incidents still unresolved.
  open: z.number().int().nonnegative(),
  // Total occurrences across every listed incident.
  occurrences: z.number().int().nonnegative(),
});

export const AdminLogQuery = z.object({
  q: z.string().trim().max(80).optional(),
  source: z.enum(['SERVER', 'CLIENT']).optional(),
  status: z.enum(['open', 'resolved']).optional(),
});

export type AdminLogLevel = z.infer<typeof AdminLogLevel>;
export type AdminLogSource = z.infer<typeof AdminLogSource>;
export type AdminLogRow = z.infer<typeof AdminLogRow>;
export type AdminLogs = z.infer<typeof AdminLogs>;
export type AdminLogQuery = z.infer<typeof AdminLogQuery>;

// ── feedback ────────────────────────────────────────────────────────────────
// What users said in words, triaged from NEW → SEEN → RESOLVED.
export const AdminFeedbackKind = z.enum(['BUG', 'COMPLAINT', 'PRAISE', 'SUGGESTION', 'OTHER']);
export const AdminFeedbackStatus = z.enum(['NEW', 'SEEN', 'RESOLVED']);

export const AdminFeedbackRow = z.object({
  id: z.string(),
  kind: AdminFeedbackKind,
  status: AdminFeedbackStatus,
  rating: z.number().int().nullable(),
  message: z.string(),
  page: z.string().nullable(),
  email: z.string().nullable(),
  // Shop it was filed against; null means the platform itself.
  shop: z.string().nullable(),
  // Who wrote it, when known — a storefront shopper is anonymous.
  reporter: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const AdminFeedbackList = z.object({
  items: z.array(AdminFeedbackRow),
  total: z.number().int().nonnegative(),
  newCount: z.number().int().nonnegative(),
});

export const AdminFeedbackQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: AdminFeedbackStatus.optional(),
  kind: AdminFeedbackKind.optional(),
});

export type AdminFeedbackKind = z.infer<typeof AdminFeedbackKind>;
export type AdminFeedbackStatus = z.infer<typeof AdminFeedbackStatus>;
export type AdminFeedbackRow = z.infer<typeof AdminFeedbackRow>;
export type AdminFeedbackList = z.infer<typeof AdminFeedbackList>;
export type AdminFeedbackQuery = z.infer<typeof AdminFeedbackQuery>;

// ── admin actions ───────────────────────────────────────────────────────────
// Account moderation from the console: promote/demote a platform operator and
// suspend/restore a sign-in. At least one field must be present. Executed
// through better-auth's admin plugin (set-role / ban-user / unban-user) so the
// plugin's own rules — session revocation on ban, self-lockout guards — apply.
export const AdminUserUpdate = z
  .object({
    role: z.enum(['admin', 'user']).optional(),
    banned: z.boolean().optional(),
  })
  .refine((value) => value.role !== undefined || value.banned !== undefined, {
    message: 'Provide role and/or banned.',
  });
export type AdminUserUpdate = z.infer<typeof AdminUserUpdate>;

// Shop moderation: open or close a storefront without touching the account.
export const AdminShopUpdate = z.object({
  active: z.boolean(),
});
export type AdminShopUpdate = z.infer<typeof AdminShopUpdate>;

export const AdminShopToggleResult = z.object({
  userId: z.string(),
  active: z.boolean(),
});
export type AdminShopToggleResult = z.infer<typeof AdminShopToggleResult>;
