// The social directory kit: platform metadata for the networks a shop is on.
// Pure and client-safe so onboarding, the manager and any contact surface
// agree on what each network is called. Socials are contact info collected at
// onboarding — there is no publishing queue.
import type { SocialPlatformValue } from '@/lib/contracts/social';

export interface SocialPlatformDef {
  value: SocialPlatformValue;
  label: string;
  hint: string;
}

export const SOCIAL_PLATFORM_DEFS: SocialPlatformDef[] = [
  {
    value: 'TIKTOK',
    label: 'TikTok',
    hint: 'Your TikTok handle, so customers find your videos.',
  },
  {
    value: 'INSTAGRAM',
    label: 'Instagram',
    hint: 'Your Instagram handle for the bio link crowd.',
  },
  {
    value: 'FACEBOOK_PAGE',
    label: 'Facebook Page',
    hint: 'Your page name for Facebook shoppers.',
  },
  {
    value: 'WHATSAPP_STATUS',
    label: 'WhatsApp',
    hint: 'The number customers chat with — usually your order number.',
  },
];
