// The automation sweep engine. This is the platform: every automation is a
// registered plugin (AUTOMATION_PLUGINS) with its own trigger + message. To add
// a new automation: add the kind to the Prisma enum + contracts/automation.ts
// metadata, then register a collect() plugin here. No AI — deterministic rules.
//
// The daily sweep (cron "run-now") evaluates every enabled rule. Two trigger
// styles, both handled by the same sweep:
//   age-gated  -> orders that sat in a status past their wait window
//   event-like -> fire once something is true (order paid, delivered, gone quiet)
//                 — deduplicated through the AutomationEvent log so a rule
//                 only fires once per order/customer.
// Every action is written to AutomationEvent so the switchboard can audit it.
//
// Tenancy: each rule belongs to one account (AutomationRule.userId) and every
// collect() below reads only that owner's orders/customers, using the rule's own
// userId. The cron sweep iterates ALL owners' rules, so this is the single place
// that guarantees one shop's rule can never text another shop's customers or
// flip another shop's orders.
import 'server-only';

import type { AutomationRule, Customer, Order, OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { isSmsConfigured, sendSms } from '@/lib/sms';

export type SweepSummary = { rules: number; nudged: number; flipped: number };
export type WeeklySummaryResult = {
  ok: boolean;
  skipped: boolean;
  sent: boolean;
  message: string | null;
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'pending',
  PROCESSING: 'being prepared',
  COMPLETED: 'done',
  CANCELLED: 'cancelled',
};

const DEFAULT_MESSAGES = {
  SMS_NUDGE:
    'Hello {customerName}, your order {orderNumber} is still {statusLabel}. Reply and we will get it moving - Tilo',
  READY_PING: 'Hello {customerName}, great news — order {orderNumber} is ready for pickup! - Tilo',
  STALL_ALERT:
    'Heads up: order {orderNumber} ({customerName}) has been {statusLabel} for too long. Deal with it - Tilo',
  PAYMENT_CONFIRMED:
    'Hello {customerName}, payment {amount} for order {orderNumber} received — thank you! - Tilo',
  PAYMENT_REMINDER:
    'Hello {customerName}, gentle reminder that {amount} is still owed for order {orderNumber}. We keep your order for pickup - Tilo',
  REVIEW_REQUEST:
    'Hello {customerName}, how was order {orderNumber}? Reply 1-5 so we do better - Tilo',
  RE_ENGAGE: 'Hello {customerName}, been a while! Want us to fire something fresh for you? - Tilo',
} as const;

function formatGhs(pesewas: number): string {
  const cedis = pesewas / 100;
  return `GH₵ ${cedis.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type RenderContext = {
  customerName: string;
  order?: Order & { customer: Customer };
};

function renderMessage(template: string | null, base: string, ctx: RenderContext): string {
  let message = (template?.trim() || base).trim();
  message = message.replaceAll('{customerName}', ctx.customerName);
  message = message.replaceAll('{orderNumber}', ctx.order?.orderNumber ?? '');
  message = message.replaceAll('{description}', ctx.order?.description ?? '');
  message = message.replaceAll('{statusLabel}', ctx.order ? STATUS_LABEL[ctx.order.status] : '');
  message = message.replaceAll(
    '{amount}',
    ctx.order?.amountPesewas != null ? formatGhs(ctx.order.amountPesewas) : '',
  );
  // Drop any placeholder the shop left in (safe templates only).
  return message
    .replace(/\{[a-zA-Z]+\}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 320);
}

type Rule = AutomationRule;

type TextAction = {
  type: 'SMS';
  orderId: string | null;
  customerId: string | null;
  to: string;
  message: string;
};
type FlipAction = {
  type: 'FLIP';
  orderId: string;
  customerId: string;
  from: OrderStatus;
  to: OrderStatus;
};
type Action = TextAction | FlipAction;

function after(now: Date, hours: number): Date {
  return new Date(now.getTime() - hours * 3_600_000);
}

function text(
  orderId: string | null,
  customerId: string | null,
  to: string,
  message: string,
): TextAction {
  return { type: 'SMS', orderId, customerId, to, message };
}

type OrderWithCustomer = Order & { customer: Customer };
type CustomerWithLatest = Customer & { orders: { createdAt: Date }[] };

type Plugin = { label: string; collect: (rule: Rule, now: Date) => Promise<Action[]> };

/** Orders that have sat in a status past the rule's wait window (this shop only). */
async function staleOrders(
  rule: Rule,
  now: Date,
  statuses?: OrderStatus[],
): Promise<OrderWithCustomer[]> {
  const threshold = after(now, rule.waitHours);
  const status = statuses ?? (rule.triggerStatus ? [rule.triggerStatus] : undefined);
  return prisma.order.findMany({
    where: {
      userId: rule.userId,
      ...(status ? { status: { in: status } } : {}),
      ...(status ? { updatedAt: { lte: threshold } } : {}),
    },
    include: { customer: true },
  });
}

function collectStatusWindow(rule: Rule, now: Date): Promise<OrderWithCustomer[]> {
  const threshold = after(now, rule.waitHours);
  if (!rule.triggerStatus) return Promise.resolve([]);
  return prisma.order.findMany({
    where: { userId: rule.userId, status: rule.triggerStatus, updatedAt: { lte: threshold } },
    include: { customer: true },
  });
}

export const AUTOMATION_PLUGINS = {
  /** Customer nudge — an order sat in a status too long. Age-gated, per order, ever. */
  SMS_NUDGE: {
    label: 'Notify',
    collect: async (rule, now): Promise<Action[]> => {
      const orders = await collectStatusWindow(rule, now);
      return orders
        .filter((order) => order.customer.phone)
        .map((order) =>
          text(
            order.id,
            order.customerId,
            order.customer.phone as string,
            renderMessage(rule.message, DEFAULT_MESSAGES.SMS_NUDGE, {
              order,
              customerName: order.customer.name,
            }),
          ),
        );
    },
  },

  /** Auto-flip — move an order to its target status after a wait window. */
  STATUS_FLIP: {
    label: 'Auto-flip',
    collect: async (rule, now): Promise<Action[]> => {
      if (!rule.targetStatus) return [];
      const orders = await collectStatusWindow(rule, now);
      return orders
        .filter((order) => order.status !== rule.targetStatus)
        .map((order) => ({
          type: 'FLIP' as const,
          orderId: order.id,
          customerId: order.customerId,
          from: order.status,
          to: rule.targetStatus as OrderStatus,
        }));
    },
  },

  /** Ready ping — text the customer when a completed order is done. */
  READY_PING: {
    label: 'Ready ping',
    collect: async (rule, now): Promise<Action[]> => {
      const orders = await staleOrders(rule, now, ['COMPLETED']);
      return orders
        .filter((order) => order.customer.phone)
        .map((order) =>
          text(
            order.id,
            order.customerId,
            order.customer.phone as string,
            renderMessage(rule.message, DEFAULT_MESSAGES.READY_PING, {
              order,
              customerName: order.customer.name,
            }),
          ),
        );
    },
  },

  /** Stall alert — text the shop owner when work is stuck. */
  STALL_ALERT: {
    label: 'Stall alert',
    collect: async (rule, now): Promise<Action[]> => {
      if (!rule.recipient) return [];
      const statuses: OrderStatus[] = rule.triggerStatus
        ? [rule.triggerStatus]
        : ['PENDING', 'PROCESSING'];
      const orders = await staleOrders(rule, now, statuses);
      return orders.map((order) =>
        text(
          order.id,
          order.customerId,
          rule.recipient as string,
          renderMessage(rule.message, DEFAULT_MESSAGES.STALL_ALERT, {
            order,
            customerName: order.customer.name,
          }),
        ),
      );
    },
  },

  /** Paid receipt — send once an order is marked paid. Event-like. */
  PAYMENT_CONFIRMED: {
    label: 'Paid receipt',
    collect: async (rule): Promise<Action[]> => {
      const orders = await prisma.order.findMany({
        where: { userId: rule.userId, paidAt: { not: null } },
        include: { customer: true },
      });
      return orders
        .filter((order) => order.customer.phone)
        .map((order) =>
          text(
            order.id,
            order.customerId,
            order.customer.phone as string,
            renderMessage(rule.message, DEFAULT_MESSAGES.PAYMENT_CONFIRMED, {
              order,
              customerName: order.customer.name,
            }),
          ),
        );
    },
  },

  /** Payment reminder — unpaid orders with an amount, past the wait window. */
  PAYMENT_REMINDER: {
    label: 'Payment reminder',
    collect: async (rule, now): Promise<Action[]> => {
      const threshold = after(now, rule.waitHours);
      const orders = await prisma.order.findMany({
        where: {
          userId: rule.userId,
          amountPesewas: { not: null },
          paidAt: null,
          // Do not nag about orders the shop already closed.
          status: { not: 'CANCELLED' },
          createdAt: { lte: threshold },
        },
        include: { customer: true },
      });
      return orders
        .filter((order) => order.customer.phone)
        .map((order) =>
          text(
            order.id,
            order.customerId,
            order.customer.phone as string,
            renderMessage(rule.message, DEFAULT_MESSAGES.PAYMENT_REMINDER, {
              order,
              customerName: order.customer.name,
            }),
          ),
        );
    },
  },

  /** Review ask — after delivery, one gentle "how was it?". */
  REVIEW_REQUEST: {
    label: 'Review ask',
    collect: async (rule, now): Promise<Action[]> => {
      const orders = await staleOrders(rule, now, ['COMPLETED']);
      return orders
        .filter((order) => order.customer.phone)
        .map((order) =>
          text(
            order.id,
            order.customerId,
            order.customer.phone as string,
            renderMessage(rule.message, DEFAULT_MESSAGES.REVIEW_REQUEST, {
              order,
              customerName: order.customer.name,
            }),
          ),
        );
    },
  },

  /** Win-back — text customers who went quiet (no order in the window). */
  RE_ENGAGE: {
    label: 'Win-back',
    collect: async (rule, now): Promise<Action[]> => {
      const threshold = after(now, rule.waitHours);
      const customers = await prisma.customer.findMany({
        where: { userId: rule.userId, phone: { not: null } },
        include: {
          orders: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      return customers
        .filter((customer: CustomerWithLatest) => {
          const latest = customer.orders[0]?.createdAt;
          // Quiet = last order older than the window, or never ordered and joined before it.
          if (latest) return latest < threshold;
          return customer.createdAt < threshold;
        })
        .map((customer) =>
          text(
            null,
            customer.id,
            customer.phone as string,
            renderMessage(rule.message, DEFAULT_MESSAGES.RE_ENGAGE, {
              customerName: customer.name,
            }),
          ),
        );
    },
  },
} satisfies Record<string, Plugin>;

// Advisory lock serialising sweeps. The dedupe check + claim happen inside the
// lock transaction, so an external cron and the admin "Run now" button can never
// text the same customer twice even if they fire at the same moment.
const SWEEP_LOCK = 'tilo_automation_sweep';

type SmsClaim = 'claimed' | 'duplicate' | 'skipped';

// Atomically check the dedupe log and claim the SMS slot inside the sweep lock.
// The claim row is written BEFORE the send, and any prior attempt (ok or not)
// counts as "already sent", so a rule fires once per order/customer, ever — a
// crash mid-send cannot produce a duplicate text.
async function claimSms(
  tx: Prisma.TransactionClient,
  rule: Rule,
  action: TextAction,
): Promise<SmsClaim> {
  // No provider configured yet: skip the action entirely (don't send, don't log).
  if (!isSmsConfigured()) return 'skipped';
  const prior = await tx.automationEvent.count({
    where: {
      ruleId: rule.id,
      kind: 'SMS_SENT',
      orderId: action.orderId,
      customerId: action.customerId,
    },
  });
  if (prior > 0) return 'duplicate';
  await tx.automationEvent.create({
    data: {
      ruleId: rule.id,
      orderId: action.orderId,
      customerId: action.customerId,
      kind: 'SMS_SENT',
      to: action.to,
      message: action.message,
      ok: false,
      detail: 'in-flight',
    },
  });
  return 'claimed';
}

/**
 * Evaluate enabled automation rules and act.
 *
 * @param now  injected clock (tests)
 * @param userId  when given, sweep ONLY that account's rules — used by the
 *   owner-triggered "Run now" button so a shop can only ever run its own
 *   automation. Omitted by the platform cron, which sweeps every shop.
 */
export async function runAutomationSweep(now = new Date(), userId?: string): Promise<SweepSummary> {
  const rules = await prisma.automationRule.findMany({
    where: { enabled: true, ...(userId ? { userId } : {}) },
  });
  let nudged = 0;
  let flipped = 0;

  for (const rule of rules) {
    const plugin = AUTOMATION_PLUGINS[rule.kind];
    if (!plugin) continue;
    const actions = await plugin.collect(rule, now);

    for (const action of actions) {
      if (action.type === 'FLIP') {
        if (action.from === action.to) continue;
        const didFlip = await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${SWEEP_LOCK}))`;
          // Re-read under the lock, scoped to the rule's owner: even if an
          // action were somehow forged with a foreign orderId, the status flip
          // can only ever land on an order this rule's shop owns.
          const current = await tx.order.findFirst({
            where: { id: action.orderId, userId: rule.userId },
            select: { status: true },
          });
          if (!current || current.status === action.to) return false;
          await tx.order.update({ where: { id: action.orderId }, data: { status: action.to } });
          await tx.automationEvent.create({
            data: {
              ruleId: rule.id,
              orderId: action.orderId,
              customerId: action.customerId,
              kind: 'STATUS_FLIPPED',
              ok: true,
              detail: `${action.from} → ${action.to}`,
            },
          });
          return true;
        });
        if (didFlip) flipped += 1;
        continue;
      }

      const claim = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${SWEEP_LOCK}))`;
        return claimSms(tx, rule, action);
      });
      if (claim !== 'claimed') continue;

      // Billed to the rule's own shop, so its "SMS this month" card reflects only
      // the messages its own automations sent.
      const result = await sendSms(action.to, action.message, 'AUTOMATION', rule.userId);
      try {
        await prisma.automationEvent.updateMany({
          where: {
            ruleId: rule.id,
            orderId: action.orderId,
            customerId: action.customerId,
            kind: 'SMS_SENT',
            ok: false,
          },
          data: { ok: result.ok, providerRef: result.providerRef, detail: result.error },
        });
      } catch {
        // The claim row stays ok:false. A later sweep treats it as already
        // attempted (no duplicate text), and the feed still shows the miss.
      }
      if (result.ok) nudged += 1;
    }
  }

  return { rules: rules.length, nudged, flipped };
}

async function runSummary(
  hours: number,
  headline: string,
  subject: 'SMS_SENT' | 'STATUS_FLIPPED' | 'SUMMARY_SENT',
): Promise<WeeklySummaryResult> {
  const recipient = env.SMS_SUMMARY_RECIPIENT?.trim();
  if (!recipient || !isSmsConfigured()) {
    return { ok: false, skipped: true, sent: false, message: null };
  }
  // Unlike every shop-facing automation above, this digest is deliberately
  // PLATFORM-wide: it is addressed to SMS_SUMMARY_RECIPIENT (the operator's own
  // number, from the environment) and never to a shop owner, so counting across
  // accounts reports platform health rather than leaking one shop's numbers to
  // another. It writes rule-less AutomationEvent rows, which belong to no shop.
  const since = new Date(Date.now() - hours * 3_600_000);
  // One brief per window: skip if a summary already landed inside this period,
  // so a double-fired cron can't result in duplicate summary texts.
  const already = await prisma.automationEvent.count({
    where: { kind: subject, ok: true, createdAt: { gte: since } },
  });
  if (already > 0) return { ok: true, skipped: true, sent: false, message: null };
  const [newOrders, completed, stuck, customers] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.order.count({ where: { status: 'COMPLETED', updatedAt: { gte: since } } }),
    prisma.order.count({
      where: { status: { in: ['PENDING', 'PROCESSING'] }, updatedAt: { lte: since } },
    }),
    prisma.customer.count(),
  ]);
  const message = `${headline} ${newOrders} new orders, ${completed} done, ${stuck} still on the stove, ${customers} people on the wall. Stuck orders: head to Tilo HQ.`;
  const result = await sendSms(recipient, message, 'SUMMARY');
  await prisma.automationEvent.create({
    data: {
      kind: subject,
      to: recipient,
      message,
      providerRef: result.providerRef,
      ok: result.ok,
      detail: result.error,
    },
  });
  return { ok: result.ok, skipped: false, sent: true, message };
}

export async function runWeeklySummary(): Promise<WeeklySummaryResult> {
  return runSummary(24 * 7, 'TILO week:', 'SUMMARY_SENT');
}

export async function runDailyBrief(): Promise<WeeklySummaryResult> {
  return runSummary(24, 'TILO today:', 'SUMMARY_SENT');
}
