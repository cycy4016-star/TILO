import { z } from 'zod';

export const SimplePushConfig = z.object({
  configured: z.boolean(),
  publicKey: z.string().nullable(),
  subscribed: z.boolean(),
});

export type SimplePushConfig = z.infer<typeof SimplePushConfig>;
