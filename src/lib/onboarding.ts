// Onboarding completion: a shop is ready when it has its identity (name,
// link word, dialable phone), at least one social, and a visual (logo or
// banner). The dashboard layout redirects here until this passes, and the
// welcome wizard saves through the same owner APIs the manager uses.
import 'server-only';

import { prisma } from '@/lib/db';

export type OnboardingStatus = {
  complete: boolean;
  hasStore: boolean;
  hasPhone: boolean;
  hasSocials: boolean;
  hasVisual: boolean;
};

export async function getOnboardingStatus(userId: string): Promise<OnboardingStatus> {
  const store = await prisma.store.findUnique({
    where: { userId },
    select: {
      name: true,
      slug: true,
      contactPhone: true,
      logo: true,
      banner: true,
      socials: { select: { id: true } },
    },
  });
  const hasStore = Boolean(store?.name?.trim() && store?.slug?.trim());
  const digits = (store?.contactPhone ?? '').replace(/\D/g, '');
  const hasPhone = digits.length >= 9;
  const hasSocials = (store?.socials.length ?? 0) > 0;
  const hasVisual = Boolean(store && (store.logo != null || store.banner != null));
  return {
    complete: hasStore && hasPhone && hasSocials && hasVisual,
    hasStore,
    hasPhone,
    hasSocials,
    hasVisual,
  };
}
