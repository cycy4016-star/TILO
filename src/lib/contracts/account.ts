// Client-safe contracts for account/profile endpoints.
import { z } from 'zod';

// Body of PUT/DELETE /api/profile/image — the updated avatar (data URL) or null.
export const ProfileImageResult = z.object({
  image: z.string().nullable(),
});

export type ProfileImageResult = z.infer<typeof ProfileImageResult>;
