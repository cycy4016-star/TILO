// "SMS this month" — reads the SmsUsage ledger so the owner can see how many
// texts the automations, OTPs and briefs burned, and what that cost on Arkesel.
'use client';

import { MessageSquareText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { formatGhs } from '@/lib/contracts/order';
import { SmsUsageOverview, type SmsUsageOverview as Usage } from '@/lib/contracts/sms';

const SOURCE_LABELS: Record<Usage['bySource'][number]['source'], string> = {
  OTP: 'Sign-in codes',
  AUTOMATION: 'Automations',
  SUMMARY: 'Daily / weekly brief',
  MANUAL: 'Manual',
};

export function SmsUsageCard() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/dashboard/sms-usage', { schema: SmsUsageOverview })
      .then((result) => {
        if (!cancelled) setUsage(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="h-40 animate-pulse rounded-xl border border-border bg-card dark:bg-stone-900" />
    );
  }

  if (error || !usage) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 dark:bg-stone-900">
        <p className="font-semibold text-foreground">Couldn&apos;t load SMS usage — try again.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm dark:bg-stone-900 sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary">
          <MessageSquareText aria-hidden className="size-3.5" /> SMS this month
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-secondary-foreground">
          ~{formatGhs(usage.monthEstimatedCostPesewas)} via SMS
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-4xl font-bold leading-none tracking-tight">{usage.monthSent}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            sent ({usage.monthCredits} credits)
          </p>
        </div>
        <div>
          <p className="text-4xl font-bold leading-none tracking-tight">{usage.monthFailed}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            failed this month
          </p>
        </div>
        <div>
          <p className="text-4xl font-bold leading-none tracking-tight">{usage.allTimeCredits}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            lifetime credits
          </p>
        </div>
      </div>

      {usage.bySource.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {usage.bySource.map((row) => (
            <span
              key={row.source}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground"
            >
              {SOURCE_LABELS[row.source]}: {row.sent}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
