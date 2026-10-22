import { z } from 'zod';

export const PushSubscriptionInput = z.object({
  endpoint: z.string().url().max(4096),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

export const PushConfig = z.object({
  configured: z.boolean(),
  publicKey: z.string().nullable(),
  subscribed: z.boolean(),
  deviceCount: z.number().int().nonnegative(),
  // Whether the merchant email fallback is actually live on this deployment.
  emailConfigured: z.boolean(),
});

export const PushEndpointInput = z.object({ endpoint: z.string().url().max(4096) });

export const PushSubscribeResult = z.object({ subscribed: z.boolean() });

export const PushTestResult = z.object({
  sent: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
});

export const PushPayload = z.object({
  title: z.string().min(1).max(120),
  body: z.string().max(500),
  url: z.string().max(512).optional(),
  tag: z.string().max(64).optional(),
  icon: z.string().max(512).optional(),
  badge: z.string().max(512).optional(),
});

export type PushSubscriptionInput = z.infer<typeof PushSubscriptionInput>;
export type PushConfig = z.infer<typeof PushConfig>;
export type PushTestResult = z.infer<typeof PushTestResult>;
export type PushPayload = z.infer<typeof PushPayload>;
