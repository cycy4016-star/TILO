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

// Tap-first options. The switchboard renders these as <Select> lists so wiring a
// rule is picking, not typing. The engine reads the SAME tables
// (src/lib/automation.ts) so the picker and the sender can never drift apart.

// "How long do I wait" — the old free-text number box. Every entry is a value
// the contract already accepts (1..1440 whole hours).
export const WAIT_PRESETS = [
  { hours: 2, label: '2 hours' },
  { hours: 6, label: '6 hours' },
  { hours: 12, label: '12 hours' },
  { hours: 24, label: '1 day' },
  { hours: 48, label: '2 days' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '1 week' },
  { hours: 336, label: '2 weeks' },
  { hours: 720, label: '30 days' },
] as const;

// Message text per kind. `template: ''` means "use Tilo's wording" — that is
// deliberately the empty string so the server default keeps owning the copy and
// an update to the house text reaches every shop that never overrode it. The
// other entries are the tap-to-send rewrites; 'CUSTOM' reveals the textarea.
export const CUSTOM_MESSAGE = 'CUSTOM';

export type MessagePreset = {
  id: string;
  label: string;
  template: string;
};

export const MESSAGE_PRESETS: Record<AutomationKindValue, MessagePreset[]> = {
  SMS_NUDGE: [
    { id: 'default', label: 'Tilo’s wording', template: '' },
    {
      id: 'friendly',
      label: 'Friendly check-in',
      template:
        'Hi {customerName}, just checking on order {orderNumber} — is everything still on track? - Tilo',
    },
    {
      id: 'urgent',
      label: 'Firm but kind',
      template:
        'Hello {customerName}, order {orderNumber} is still {statusLabel}. Can we confirm when you will be able to take it? - Tilo',
    },
  ],
  STATUS_FLIP: [],
  READY_PING: [
    { id: 'default', label: 'Tilo’s wording', template: '' },
    {
      id: 'pickup',
      label: 'Ready for pickup',
      template:
        'Hello {customerName}, order {orderNumber} is ready — come and collect it whenever suits you! - Tilo',
    },
  ],
  STALL_ALERT: [
    { id: 'default', label: 'Tilo’s wording', template: '' },
    {
      id: 'short',
      label: 'Short alert',
      template: 'Order {orderNumber} ({customerName}) has been {statusLabel} too long - Tilo',
    },
  ],
  PAYMENT_CONFIRMED: [
    { id: 'default', label: 'Tilo’s wording', template: '' },
    {
      id: 'thanks',
      label: 'Warm thank-you',
      template:
        'Thank you {customerName}! We have received {amount} for order {orderNumber}. - Tilo',
    },
  ],
  PAYMENT_REMINDER: [
    { id: 'default', label: 'Tilo’s wording', template: '' },
    {
      id: 'polite',
      label: 'Polite nudge',
      template:
        'Hello {customerName}, {amount} is still outstanding on order {orderNumber}. No rush - just so you know. - Tilo',
    },
    {
      id: 'holding',
      label: 'Order on hold',
      template:
        'Hi {customerName}, we are holding order {orderNumber} ({amount}) until payment clears. - Tilo',
    },
  ],
  REVIEW_REQUEST: [
    { id: 'default', label: 'Tilo’s wording', template: '' },
    {
      id: 'rating',
      label: '1–5 rating',
      template:
        'Hello {customerName}, thanks for taking order {orderNumber}! Rate us 1-5 with a reply. - Tilo',
    },
  ],
  RE_ENGAGE: [
    { id: 'default', label: 'Tilo’s wording', template: '' },
    {
      id: 'offer',
      label: 'Come back offer',
      template:
        'Hello {customerName}, it has been a while! We would love to have you back - reply and we will send you our latest. - Tilo',
    },
  ],
};

// Suggested rule names so "Name this rule" starts filled in for anyone who does
// not want to invent one. Purely a default — the field stays editable.
export const KIND_NAME_SUGGESTION: Record<AutomationKindValue, string> = {
  SMS_NUDGE: 'Nudge orders waiting too long',
  STATUS_FLIP: 'Auto-advance orders',
  READY_PING: 'Text when an order is done',
  STALL_ALERT: 'Alert me about stuck orders',
  PAYMENT_CONFIRMED: 'Thank customers who pay',
  PAYMENT_REMINDER: 'Chase unpaid orders',
  REVIEW_REQUEST: 'Ask for a review after delivery',
  RE_ENGAGE: 'Win back quiet customers',
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
