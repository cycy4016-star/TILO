// Social publishing UI for the store manager: the platform picker, caption
// composer and post-history log.
//
// Split out of store-workspace.tsx — that file owns the catalogue and every
// form around it, and this block is self-contained (its own icon map, its own
// helpers, no shared form utilities), so it moves as a unit.
'use client';

import {
  ArrowLeft,
  Camera,
  ExternalLink,
  type LucideIcon,
  Megaphone,
  MessageCircle,
  Music2,
  Share2,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';
import {
  type SocialPlatformValue,
  SocialPostRecord,
  type SocialPostStatusValue,
} from '@/lib/contracts/social';
import type {
  StoreItem as StoreItemRecord,
  StorePayload as StoreRecord,
} from '@/lib/contracts/store';
import {
  buildSocialCaption,
  SOCIAL_PLATFORM_DEFS,
  type SocialPlatformDef,
  shareUrlFor,
} from '@/lib/social';

const platformIcons: Record<SocialPlatformValue, LucideIcon> = {
  TIKTOK: Music2,
  INSTAGRAM: Camera,
  FACEBOOK_PAGE: Megaphone,
  WHATSAPP_STATUS: MessageCircle,
};

const statusStyles: Record<SocialPostStatusValue, string> = {
  SHARED: 'bg-muted text-muted-foreground',
  PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};

function platformDef(value: SocialPlatformValue): SocialPlatformDef {
  const entry = SOCIAL_PLATFORM_DEFS.find((candidate) => candidate.value === value);
  if (!entry) throw new Error(`Unknown social platform: ${value}`);
  return entry;
}

function formatPostTime(value: string): string {
  return new Date(value).toLocaleString('en-GH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PlatformBadge({ value }: { value: SocialPlatformValue }) {
  const def = platformDef(value);
  const Icon = platformIcons[def.value];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
      <Icon aria-hidden className="size-3.5" /> {def.label}
    </span>
  );
}

function PublishDialog({
  item,
  store,
  onLogged,
  onClose,
}: {
  item: StoreItemRecord;
  store: StoreRecord;
  onLogged: (post: SocialPostRecord) => void;
  onClose: () => void;
}) {
  const [platform, setPlatform] = useState<SocialPlatformValue | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);

  const storefrontUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/store/${store.slug}`
      : `/store/${store.slug}`;

  function pick(entry: SocialPlatformDef) {
    setPlatform(entry.value);
    setCaption(buildSocialCaption(item, store.name, storefrontUrl, entry.value));
  }

  async function publish() {
    if (!platform) return;
    const def = platformDef(platform);
    const target = shareUrlFor(platform, caption);
    if (target) {
      const opened = window.open(target, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.href = target;
    }
    setBusy(true);
    try {
      try {
        await navigator.clipboard.writeText(caption);
      } catch {
        toast.warning('Copy failed — grab the caption from the box below');
      }
      const post = await apiFetch('/api/store/posts', {
        method: 'POST',
        body: JSON.stringify({ itemId: item.id, platform, caption }),
        schema: SocialPostRecord,
      });
      onLogged(post);
      toast.success(
        target
          ? `${def.label} opened — finish the post there`
          : `Caption copied — paste it as your ${def.label}`,
      );
      onClose();
    } catch {
      toast.error('Could not log the post');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      {platform === null ? (
        <div className="grid gap-2">
          {SOCIAL_PLATFORM_DEFS.map((entry) => {
            const Icon = platformIcons[entry.value];
            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => pick(entry)}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:bg-muted"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{entry.label}</span>
                  <span className="block text-xs text-muted-foreground">{entry.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Back to platforms"
              onClick={() => {
                setPlatform(null);
                setCaption('');
              }}
              className="size-9 rounded-full"
            >
              <ArrowLeft aria-hidden className="size-4" />
            </Button>
            <PlatformBadge value={platform} />
          </div>
          <div className="grid gap-2">
            <label
              htmlFor="publish-caption"
              className="text-sm font-semibold text-muted-foreground"
            >
              Caption
            </label>
            <textarea
              id="publish-caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={6}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              We copy this and open {platformDef(platform).label} — posting stays hands-on. Tweak it
              here first.
            </p>
          </div>
          <Button
            type="button"
            disabled={busy || caption.trim().length === 0}
            onClick={() => void publish()}
            className="h-11 font-semibold"
          >
            <Share2 aria-hidden className="size-4" />
            {busy ? 'Opening…' : `Copy & open ${platformDef(platform).label}`}
          </Button>
        </div>
      )}
    </div>
  );
}

function PublishLog({
  posts,
  onMarked,
  onRemoved,
}: {
  posts: SocialPostRecord[];
  onMarked: (post: SocialPostRecord) => void;
  onRemoved: (postId: string) => void;
}) {
  const [markingUrl, setMarkingUrl] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function markPosted(post: SocialPostRecord) {
    setBusyId(post.id);
    try {
      const updated = await apiFetch(`/api/store/posts/${post.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PUBLISHED', externalUrl: url.trim() || null }),
        schema: SocialPostRecord,
      });
      onMarked(updated);
      setMarkingUrl(null);
      setUrl('');
      toast.success('Marked as posted');
    } catch {
      toast.error('Could not save that');
    } finally {
      setBusyId(null);
    }
  }

  async function removePost(post: SocialPostRecord) {
    try {
      await apiFetch(`/api/store/posts/${post.id}`, { method: 'DELETE' });
      onRemoved(post.id);
      toast.success('Removed from the log');
    } catch {
      toast.error('Could not remove');
    }
  }

  function reopen(post: SocialPostRecord) {
    const reopenUrl = shareUrlFor(post.platform, post.caption);
    if (reopenUrl) {
      const opened = window.open(reopenUrl, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.href = reopenUrl;
      return;
    }
    void navigator.clipboard
      .writeText(post.caption)
      .then(() => toast.success('Caption copied'))
      .catch(() => toast.warning('Copy failed — select the caption yourself'));
  }

  if (posts.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border px-5 py-8 text-center">
        <p className="font-semibold">Nothing pushed yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap Share on an item and it lands here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-3">
      {posts.map((post) => {
        const Icon = platformIcons[post.platform];
        return (
          <div key={post.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <PlatformBadge value={post.platform} />
              <span className="min-w-0 truncate text-sm font-semibold">{post.itemName}</span>
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${statusStyles[post.status]}`}
              >
                {post.status === 'PUBLISHED' ? 'Posted' : 'Shared'}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatPostTime(post.createdAt)}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {post.caption}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {post.status === 'PUBLISHED' && post.externalUrl ? (
                <Button
                  asChild
                  variant="outline"
                  className="h-9 rounded-full text-xs font-semibold"
                >
                  <a href={post.externalUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink aria-hidden className="size-3.5" /> View post
                  </a>
                </Button>
              ) : markingUrl === post.id ? (
                <>
                  <Input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="Paste the post link…"
                    className="h-9 min-w-0 flex-1 rounded-full text-sm"
                  />
                  <Button
                    type="button"
                    disabled={busyId === post.id}
                    onClick={() => void markPosted(post)}
                    className="h-9 rounded-full font-semibold"
                  >
                    {busyId === post.id ? 'Saving…' : 'Done'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setMarkingUrl(null);
                      setUrl('');
                    }}
                    className="h-9 rounded-full text-xs font-semibold"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => reopen(post)}
                    className="h-9 rounded-full text-xs font-semibold"
                  >
                    <Icon aria-hidden className="size-3.5" /> Reopen
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMarkingUrl(post.id)}
                    className="h-9 rounded-full text-xs font-semibold"
                  >
                    Mark posted
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove from log"
                onClick={() => void removePost(post)}
                className="ml-auto size-9 rounded-full text-red-600 hover:text-red-700"
              >
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { PublishDialog, PublishLog };
