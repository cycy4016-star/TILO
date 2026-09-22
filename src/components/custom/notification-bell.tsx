// The dashboard bell: the live activity feed. Polls /api/notifications every
// 15 seconds while the dashboard is open, shows an unread badge, and "Got it"
// clears the feed. Events come from storefront orders, visitor captures and
// SMS sends.
'use client';

import { Bell, Check, MessageCircleX, MessageSquareMore, Package, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiFetch } from '@/lib/api-client';
import {
  NotificationFeed,
  NotificationKind,
  NotificationReadResult,
  type NotificationRecord,
} from '@/lib/contracts/notification';

const POLL_MS = 15_000;
const kindLabels: Record<NotificationRecord['kind'], string> = {
  VISITOR_CAPTURED: 'Visitor',
  ORDER_PLACED: 'Order',
  SMS_SENT: 'SMS sent',
  SMS_FAILED: 'SMS failed',
};

function kindIcon(kind: NotificationRecord['kind']) {
  switch (kind) {
    case 'VISITOR_CAPTURED':
      return UserPlus;
    case 'ORDER_PLACED':
      return Package;
    case 'SMS_SENT':
      return MessageSquareMore;
    case 'SMS_FAILED':
      return MessageCircleX;
  }
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const [feed, setFeed] = useState<NotificationFeed | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setFeed(await apiFetch('/api/notifications', { schema: NotificationFeed }));
    } catch {
      // Keep the last good feed; the badge just stays where it was.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function markRead() {
    try {
      await apiFetch('/api/notifications/read', {
        method: 'POST',
        body: '{}',
        schema: NotificationReadResult,
      });
      setFeed((current) =>
        current
          ? {
              ...current,
              unreadCount: 0,
              items: current.items.map((n) => ({ ...n, readAt: new Date().toISOString() })),
            }
          : current,
      );
    } catch {
      // Swallow — next poll restores the truth.
    }
  }

  const unread = feed?.unreadCount ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Activity, ${unread} unread`}
          onClick={() => void load()}
          className="relative size-9 rounded-full border-2 border-amber-950/20 bg-transparent text-amber-950 hover:bg-amber-950/10"
        >
          <Bell aria-hidden className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-red-600 text-[0.65rem] font-black text-white ring-2 ring-amber-300">
              {unread > 99 ? '99' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 rounded-[1.5rem] border-2 border-amber-950 bg-white p-3 shadow-[5px_5px_0_0_#451a03] dark:bg-stone-900"
      >
        <div className="flex items-center justify-between gap-2 px-1 pb-2">
          <p className="font-display text-sm font-black uppercase tracking-wide">Live feed</p>
          {unread > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={() => void markRead()}
              className="h-7 rounded-full bg-yellow-600 px-3 text-[0.7rem] font-black uppercase tracking-wide text-white hover:bg-amber-700"
            >
              <Check aria-hidden className="size-3" /> Got it
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {!feed || feed.items.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs font-bold uppercase tracking-widest text-stone-400">
              Nothing cooking yet
            </p>
          ) : (
            <ol className="space-y-1">
              {feed.items.map((item) => {
                const Icon = kindIcon(item.kind);
                const read = item.readAt != null;
                return (
                  <li
                    key={item.id}
                    className={`flex gap-3 rounded-2xl p-2.5 ${read ? 'opacity-60' : 'bg-amber-50 dark:bg-stone-800'}`}
                  >
                    <span
                      className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl ${
                        item.kind === 'SMS_FAILED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-600 text-white'
                      }`}
                    >
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                        {kindLabels[NotificationKind.parse(item.kind)]}
                        <span className="font-medium normal-case tracking-normal text-stone-400">
                          {timeAgo(item.createdAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-black">{item.title}</span>
                      {item.message && (
                        <span className="mt-0.5 block truncate text-xs font-medium text-stone-500">
                          {item.message}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
