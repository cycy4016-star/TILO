// Free-trial status strip for the dashboard. Reads the trial window off the
// session user (stamped at sign-up, see src/lib/trial.ts) and shows how many
// days are left — or a gentle "trial ended" nudge once it lapses. Purely
// informational: it never blocks the workspace, so a shop that outgrows the
// trial still sees its data.
'use client';

import { Sparkles } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { TRIAL_DAYS, trialState } from '@/lib/trial';
import { cn } from '@/lib/utils';

export function TrialBanner() {
  const { data: session } = useSession();
  const trialEndsAt = (session?.user as { trialEndsAt?: Date | string | null } | undefined)
    ?.trialEndsAt;
  if (!trialEndsAt) return null;

  const { active, daysLeft } = trialState(trialEndsAt);

  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b px-4 py-2 text-small sm:px-6',
        active
          ? 'border-highlight/25 bg-highlight-wash text-foreground'
          : 'border-border bg-muted text-muted-foreground',
      )}
    >
      <Sparkles aria-hidden className={cn('size-4 shrink-0', active && 'text-primary')} />
      {active ? (
        <p>
          <span className="font-semibold">
            Free trial — {daysLeft} of {TRIAL_DAYS} days left.
          </span>{' '}
          Enjoy the full toolkit: catalogue, orders, promos and analytics.
        </p>
      ) : (
        <p>
          <span className="font-semibold">Your free trial has ended.</span> Add a plan to keep
          selling — your shop and data are safe.
        </p>
      )}
    </div>
  );
}
