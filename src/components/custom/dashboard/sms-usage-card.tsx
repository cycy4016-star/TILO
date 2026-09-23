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
      <section className="h-40 animate-pulse rounded-[1.75rem] border-2 border-amber-950 bg-white dark:bg-stone-900" />
    );
  }

  if (error || !usage) {
    return (
      <section className="rounded-[1.75rem] border-2 border-amber-950 bg-white p-6 dark:bg-stone-900">
        <p className="font-bold text-amber-700">Could not load SMS usage — try again.</p>
      </section>
    );
  }

  return (
    <section className="rotate-[0.4deg] rounded-[2rem] border-2 border-amber-950 bg-[#fffbeb] p-6 shadow-[5px_5px_0_0_#451a03] dark:bg-stone-900 sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-950 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.18em] text-amber-300">
          <MessageSquareText aria-hidden className="size-3.5" /> SMS this month
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-200 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.18em] text-amber-950">
          ~{formatGhs(usage.monthEstimatedCostPesewas)} via SMS
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="font-display text-4xl font-black uppercase leading-none">
            {usage.monthSent}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-stone-500">
            sent ({usage.monthCredits} credits)
          </p>
        </div>
        <div>
          <p className="font-display text-4xl font-black uppercase leading-none">
            {usage.monthFailed}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-stone-500">
            failed this month
          </p>
        </div>
        <div>
          <p className="font-display text-4xl font-black uppercase leading-none">
            {usage.allTimeCredits}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-stone-500">
            lifetime credits
          </p>
        </div>
      </div>

      {usage.bySource.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {usage.bySource.map((row) => (
            <span
              key={row.source}
              className="rounded-full border border-amber-300 px-3 py-1 text-xs font-bold text-amber-900 dark:border-stone-700 dark:text-amber-200"
            >
              {SOURCE_LABELS[row.source]}: {row.sent}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
