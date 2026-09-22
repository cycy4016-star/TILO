// client-safe automation contracts shared by API routes and dashboard islands.
import { z } from 'zod';
import { OrderStatus } from '@/lib/contracts/order';

export const AutomationKind = z.enum([
  'SMS_NUDGE',
  'STATUS_FLIP',
  'READY_PING',
  'STALL_ALERT',
  'PAYMENT_CONFIRMED',
  'PAYMENT_REMINDER',
  'REVIEW_REQUEST',
  'RE_ENGAGE',
]);

// Client-safe metadata so the switchboard renders per-kind fields without
// importing the server-only engine. This is the "plugin catalogue" — add a
// button here + a plugin in src/lib/automation.ts to ship a new automation.
export type AutomationKindMeta = {
  label: string;
  blurb: string; // one-line pitch for the picker
  icon: 'SMS' | 'FLIP' | 'PAYMENT' | 'ALERT' | 'RETRY';
  requiresStatus: boolean;
  requiresRecipient: boolean;
  requiresTarget: boolean;
  usesMessage: boolean;
  // Suggested trigger status when the kind is selected fresh.
  defaultStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED';
};

export const AUTOMATION_KIND_META: Record<AutomationKindValue, AutomationKindMeta> = {
  SMS_NUDGE: {
    label: 'Notify',
    blurb: 'Text the customer a nudge when an order sits too long.',
    icon: 'SMS',
    requiresStatus: true,
    requiresRecipient: false,
    requiresTarget: false,
    usesMessage: true,
    defaultStatus: 'PENDING',
  },
  STATUS_FLIP: {
    label: 'Auto-flip',
    blurb: 'Move an order to the next status automatically.',
    icon: 'FLIP',
    requiresStatus: true,
    requiresRecipient: false,
    requiresTarget: true,
    usesMessage: false,
    defaultStatus: 'PENDING',
  },
  READY_PING: {
    label: 'Ready ping',
    blurb: 'Text the customer the moment an order is done.',
    icon: 'SMS',
    requiresStatus: true,
    requiresRecipient: false,
    requiresTarget: false,
    usesMessage: true,
    defaultStatus: 'COMPLETED',
  },
  STALL_ALERT: {
    label: 'Stall alert',
    blurb: 'Text YOU when an order has been stuck too long.',
    icon: 'ALERT',
    requiresStatus: true,
    requiresRecipient: true,
    requiresTarget: false,
    usesMessage: true,
    defaultStatus: 'PENDING',
  },
  PAYMENT_CONFIRMED: {
    label: 'Paid receipt',
    blurb: 'Text the customer a receipt when the order is marked paid.',
    icon: 'PAYMENT',
    requiresStatus: false,
    requiresRecipient: false,
    requiresTarget: false,
    usesMessage: true,
    defaultStatus: 'PENDING',
  },
  PAYMENT_REMINDER: {
    label: 'Payment reminder',
    blurb: 'Chase an unpaid order with an amount on it.',
    icon: 'PAYMENT',
    requiresStatus: false,
    requiresRecipient: false,
    requiresTarget: false,
    usesMessage: true,
    defaultStatus: 'PENDING',
  },
  REVIEW_REQUEST: {
    label: 'Review ask',
    blurb: 'Text the customer after delivery — "how was it? reply 1-5".',
    icon: 'RETRY',
    requiresStatus: true,
    requiresRecipient: false,
    requiresTarget: false,
    usesMessage: true,
    defaultStatus: 'COMPLETED',
  },
  RE_ENGAGE: {
    label: 'Win-back',
    blurb: 'Text customers who went quiet — no order in weeks.',
    icon: 'RETRY',
    requiresStatus: false,
    requiresRecipient: false,
    requiresTarget: false,
    usesMessage: true,
    defaultStatus: 'PENDING',
  },
};

const AutomationRuleBase = z.object({
  name: z.string().trim().min(1, 'Give the rule a name').max(60, 'Name is too long'),
  kind: AutomationKind,
  triggerStatus: OrderStatus.optional(),
  waitHours: z.coerce
    .number()
    .int('Whole hours only')
    .min(1, 'At least 1 hour')
    .max(24 * 60, 'Max 60 days'),
  message: z.string().trim().max(320, 'Message too long').optional(),
  recipient: z
    .string()
    .trim()
    .max(40, 'Phone number is too long')
    .regex(/^[0-9+()\s-]{6,40}$/, 'Enter a valid phone number')
    .optional(),
  targetStatus: OrderStatus.optional(),
  enabled: z.boolean().default(true),
});

export const AutomationRuleCreate = AutomationRuleBase.superRefine((value, ctx) => {
  if (value.kind === 'STATUS_FLIP' && !value.targetStatus) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Pick a target status for auto-flip',
      path: ['targetStatus'],
    });
  }
  const meta = AUTOMATION_KIND_META[value.kind];
  if (meta.requiresStatus && !value.triggerStatus) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Pick which status this watches',
      path: ['triggerStatus'],
    });
  }
  if (meta.requiresRecipient && !value.recipient) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Add the phone to alert',
      path: ['recipient'],
    });
  }
});

// For updates the route merges the stored rule with the patch and re-validates
// against AutomationRuleCreate, so partial() needs no cross-field refine itself.
export const AutomationRuleUpdate = AutomationRuleBase.partial();

export const AutomationRuleItem = z.object({
  id: z.string(),
  name: z.string(),
  kind: AutomationKind,
  triggerStatus: OrderStatus.nullable(),
  waitHours: z.number(),
  message: z.string().nullable(),
  recipient: z.string().nullable(),
  targetStatus: OrderStatus.nullable(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const AutomationRuleList = z.object({ items: z.array(AutomationRuleItem) });

export const AutomationEventItem = z.object({
  id: z.string(),
  kind: z.enum(['SMS_SENT', 'STATUS_FLIPPED', 'SUMMARY_SENT']),
  orderId: z.string().nullable(),
  to: z.string().nullable(),
  message: z.string().nullable(),
  ok: z.boolean(),
  detail: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const AutomationEventList = z.object({ items: z.array(AutomationEventItem) });

export const AutomationSweepResult = z.object({
  rules: z.number(),
  nudged: z.number(),
  flipped: z.number(),
});

export type AutomationKindValue = z.infer<typeof AutomationKind>;
export type AutomationRuleCreateInput = z.infer<typeof AutomationRuleCreate>;
export type AutomationRuleUpdateInput = z.infer<typeof AutomationRuleUpdate>;
export type AutomationRuleItem = z.infer<typeof AutomationRuleItem>;
export type AutomationEventItem = z.infer<typeof AutomationEventItem>;
