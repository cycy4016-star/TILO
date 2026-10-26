'use client';

import { BarChart3, Eye, MessageCircle, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { StorefrontAnalytics, type StorefrontAnalyticsValue } from '@/lib/contracts/analytics';
import { formatGhs } from '@/lib/contracts/order';
import { cn } from '@/lib/utils';

const DAY_OPTIONS = [7, 14, 30] as const;

function sourceLabel(value: string) {
  if (value === 'Direct') return 'Direct';
  if (value.includes('.')) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function dayLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function StorefrontAnalyticsPanel() {
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(14);
  const [data, setData] = useState<StorefrontAnalyticsValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (range: number, silent = false) => {
    if (!silent) setLoading(true);
    setFailed(false);
    try {
      const result = await apiFetch(`/api/dashboard/analytics?days=${range}`, {
        schema: StorefrontAnalytics,
      });
      setData(result);
    } catch {
      if (!silent) {
        setFailed(true);
        toast.error('Could not load storefront traffic.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const maxViews = Math.max(1, ...(data?.daily.map((entry) => entry.views) ?? []));
  const maxSource = Math.max(1, ...(data?.sources.map((entry) => entry.views) ?? []));
  const hasTraffic = (data?.views ?? 0) > 0;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-eyebrow">
            <BarChart3 aria-hidden className="size-3.5" /> Storefront traffic
          </p>
          <h2 className="mt-1 font-display text-h3">Who is visiting your page</h2>
          <p className="mt-1 max-w-lg text-small text-muted-foreground">
            Page views, unique visitors, orders placed on your link, and where people came from.
          </p>
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {DAY_OPTIONS.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={days === option ? 'default' : 'ghost'}
              onClick={() => setDays(option)}
              className={cn('h-8 rounded px-3 font-semibold', days === option && 'shadow-sm')}
            >
              {option}d
            </Button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="mt-5 h-48 animate-pulse rounded-lg border border-border bg-muted/40" />
      ) : failed ? (
        <div className="mt-5 rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <p className="text-small text-muted-foreground">Traffic could not be loaded.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load(days)}
            className="mt-3 font-semibold"
          >
            Try again
          </Button>
        </div>
      ) : data ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Page views', value: data.views.toLocaleString(), icon: Eye },
              { label: 'Unique visitors', value: data.visitors.toLocaleString(), icon: Users },
              {
                label: 'Storefront orders',
                value: data.storefrontOrders.toLocaleString(),
                icon: ShoppingBag,
              },
              {
                label: 'Leads captured',
                value: data.leads.toLocaleString(),
                icon: MessageCircle,
              },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border bg-muted/20 p-3">
                <stat.icon aria-hidden className="size-4 text-primary" />
                <p className="mt-2 font-display text-h3">{stat.value}</p>
                <p className="text-caption text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-small font-semibold">Daily reach</p>
              <div className="flex items-center gap-3 text-caption text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-primary/25" /> Views
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-primary" /> Visitors
                </span>
              </div>
            </div>
            {hasTraffic ? (
              <div className="mt-4 flex h-36 items-end gap-1.5">
                {data.daily.map((entry) => (
                  <div
                    key={entry.day}
                    className="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
                    title={`${dayLabel(entry.day)}: ${entry.views} views, ${entry.visitors} visitors, ${entry.orders} orders`}
                  >
                    <div className="flex h-full w-full items-end justify-center gap-0.5">
                      <span
                        className="w-full max-w-3 rounded-t-sm bg-primary/20"
                        style={{ height: `${Math.max(3, (entry.views / maxViews) * 100)}%` }}
                      />
                      <span
                        className="w-full max-w-3 rounded-t-sm bg-primary"
                        style={{ height: `${Math.max(3, (entry.visitors / maxViews) * 100)}%` }}
                      />
                    </div>
                    <span className="hidden text-[10px] text-muted-foreground sm:block">
                      {dayLabel(entry.day)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center">
                <TrendingUp aria-hidden className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-small font-medium">No visits in this window yet</p>
                <p className="mt-1 text-caption text-muted-foreground">
                  Share your page link or a product on WhatsApp, then watch it here.
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="text-small font-semibold">Where visitors came from</p>
              {data.sources.length > 0 ? (
                <ul className="mt-3 grid gap-2.5">
                  {data.sources.map((source) => (
                    <li key={source.source} className="grid gap-1">
                      <div className="flex items-center justify-between gap-2 text-caption">
                        <span className="font-medium">{sourceLabel(source.source)}</span>
                        <span className="text-muted-foreground">{source.views}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(source.views / maxSource) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-small text-muted-foreground">
                  No traffic sources to show yet.
                </p>
              )}
            </div>
            <div className="grid gap-3">
              <div className="rounded-lg border border-border bg-highlight-wash/50 p-4">
                <p className="text-caption font-semibold text-muted-foreground">
                  Visitor-to-order rate
                </p>
                <p className="mt-1 font-display text-h2 text-highlight-ink">
                  {data.conversionRate.toFixed(1)}%
                </p>
                <p className="text-caption text-muted-foreground">
                  {data.storefrontOrders} orders from {data.visitors} unique visitors
                </p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-caption font-semibold text-muted-foreground">
                  Storefront order value
                </p>
                <p className="mt-1 font-display text-h3">
                  {formatGhs(data.storefrontRevenuePesewas)}
                </p>
                <p className="text-caption text-muted-foreground">
                  Placed orders, excluding cancelled. Manual orders are not counted.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
