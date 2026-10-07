// Socials + auto-post panels for the store manager: connect the networks the
// owner taps to post, pick the generation rhythm, and work the ready-made
// drafts. Split out of store-workspace so the catalogue file stays readable.
'use client';

import { Camera, type LucideIcon, Megaphone, MessageCircle, Music2, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PublishLog } from '@/components/custom/store-publish';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-client';
import {
  type AutoPostGenerateResult,
  AutoPostGenerateResult as AutoPostResultSchema,
  type AutoPostSettings,
  AutoPostSettings as AutoPostSettingsSchema,
  SocialAccountList,
  type SocialAccountRecord,
  type SocialPlatformValue,
} from '@/lib/contracts/social';
import type { StorePayload as StoreRecord } from '@/lib/contracts/store';
import { SOCIAL_PLATFORM_DEFS } from '@/lib/social';

const platformIcons: Record<SocialPlatformValue, LucideIcon> = {
  TIKTOK: Music2,
  INSTAGRAM: Camera,
  FACEBOOK_PAGE: Megaphone,
  WHATSAPP_STATUS: MessageCircle,
};

function platformLabel(value: SocialPlatformValue): string {
  return SOCIAL_PLATFORM_DEFS.find((entry) => entry.value === value)?.label ?? value;
}

export function SocialsPanel() {
  const [accounts, setAccounts] = useState<SocialAccountRecord[] | null>(null);
  const [platform, setPlatform] = useState<SocialPlatformValue>('TIKTOK');
  const [handle, setHandle] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/store/socials', { schema: SocialAccountList })
      .then((result) => {
        if (!cancelled) setAccounts(result.items);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const used = useMemo(() => new Set((accounts ?? []).map((a) => a.platform)), [accounts]);
  const available = SOCIAL_PLATFORM_DEFS.filter((entry) => !used.has(entry.value));

  useEffect(() => {
    if (available.length > 0 && !used.has(platform)) return;
    const fallback = available[0]?.value;
    if (fallback) setPlatform(fallback);
  }, [available, used, platform]);

  async function persist(next: { platform: string; handle: string; url: string | null }[]) {
    setSaving(true);
    try {
      const saved = await apiFetch('/api/store/socials', {
        method: 'PUT',
        body: JSON.stringify({ accounts: next }),
        schema: SocialAccountList,
      });
      setAccounts(saved.items);
      return true;
    } catch {
      toast.error('Could not save the socials');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addAccount() {
    if (!handle.trim()) {
      toast.error('Add the handle for this account');
      return;
    }
    const next = [
      ...(accounts ?? []).map((a) => ({ platform: a.platform, handle: a.handle, url: a.url })),
      { platform, handle: handle.trim(), url: url.trim() ? url.trim() : null },
    ];
    const ok = await persist(next);
    if (ok) {
      setHandle('');
      setUrl('');
      toast.success(`${platformLabel(platform)} connected`);
    }
  }

  async function removeAccount(id: string) {
    const next = (accounts ?? [])
      .filter((a) => a.id !== id)
      .map((a) => ({ platform: a.platform, handle: a.handle, url: a.url }));
    const ok = await persist(next);
    if (ok) toast.success('Account removed');
  }

  return (
    <div className="grid gap-4">
      {accounts === null ? (
        <p className="text-sm text-muted-foreground">Loading socials…</p>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center">
          <p className="font-semibold">No socials connected</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add each place you post — auto drafts are written one per connected network.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {accounts.map((account) => {
            const Icon = platformIcons[account.platform];
            return (
              <li
                key={account.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {platformLabel(account.platform)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {account.handle}
                    {account.url ? ` · ${account.url}` : ''}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${platformLabel(account.platform)}`}
                  onClick={() => void removeAccount(account.id)}
                  disabled={saving}
                  className="size-9 rounded-md text-destructive"
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {available.length === 0 ? (
        <p className="text-xs text-muted-foreground">All four networks are connected.</p>
      ) : (
        <div className="grid gap-2 rounded-xl border border-border bg-muted/40 p-4">
          <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
            <Select
              value={platform}
              onValueChange={(value) => setPlatform(value as SocialPlatformValue)}
            >
              <SelectTrigger className="rounded-md bg-card" aria-label="Network">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {available.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              placeholder="@ama.kente or page name"
              className="rounded-md bg-card"
              aria-label="Handle"
            />
          </div>
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Profile link (optional)"
            className="rounded-md bg-card"
            aria-label="Profile link"
          />
          <Button
            type="button"
            onClick={() => void addAccount()}
            disabled={saving || handle.trim().length === 0}
            className="h-10 rounded-md font-semibold"
          >
            {saving ? 'Saving…' : 'Connect account'}
          </Button>
        </div>
      )}
    </div>
  );
}

const CADENCE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: '1', label: 'Every day' },
  { value: '3', label: 'Every 3 days' },
  { value: '7', label: 'Every week' },
  { value: '14', label: 'Every 2 weeks' },
  { value: '30', label: 'Every month' },
];

function formatDateTime(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleString('en-GH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AutoPostsPanel({
  store,
  posts,
  onStoreSaved,
  onGenerated,
  onMarked,
  onRemoved,
}: {
  store: StoreRecord;
  posts: import('@/lib/contracts/social').SocialPostRecord[] | null;
  onStoreSaved: (store: StoreRecord) => void;
  onGenerated: () => void;
  onMarked: (post: import('@/lib/contracts/social').SocialPostRecord) => void;
  onRemoved: (postId: string) => void;
}) {
  const [settings, setSettings] = useState<AutoPostSettings | null>({
    days: store.autoPostDays,
    lastAt: store.autoPostLastAt,
    nextAt: null,
  });
  const [days, setDays] = useState<string>(
    store.autoPostDays == null ? 'off' : String(store.autoPostDays),
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/store/posts/auto', { schema: AutoPostSettingsSchema })
      .then((result) => {
        if (cancelled) return;
        setSettings(result);
        setDays(result.days == null ? 'off' : String(result.days));
      })
      .catch(() => {
        // Keep the store-derived initial settings — the panel still works
        // offline from what the manager already holds.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pending = useMemo(
    () => (posts ?? []).filter((post) => post.auto && post.status === 'SHARED'),
    [posts],
  );

  async function saveCadence() {
    setSaving(true);
    try {
      const autoPostDays = days === 'off' ? null : Number.parseInt(days, 10);
      const saved = await apiFetch('/api/store', {
        method: 'PUT',
        body: JSON.stringify({
          name: store.name,
          slug: store.slug,
          tagline: store.tagline ?? undefined,
          description: store.description ?? undefined,
          promoBanner: store.promoBanner ?? undefined,
          contactPhone: store.contactPhone ?? undefined,
          active: store.active,
          theme: store.theme,
          appearance: store.appearance,
          autoPostDays,
        }),
        schema: (await import('@/lib/contracts/store')).StorePayload,
      });
      onStoreSaved(saved);
      const refreshed = await apiFetch('/api/store/posts/auto', {
        schema: AutoPostSettingsSchema,
      });
      setSettings(refreshed);
      toast.success(days === 'off' ? 'Auto-posting switched off' : 'Posting rhythm saved');
    } catch {
      toast.error('Could not save the rhythm');
    } finally {
      setSaving(false);
    }
  }

  async function generateNow() {
    setGenerating(true);
    try {
      const result: AutoPostGenerateResult = await apiFetch('/api/store/posts/auto', {
        method: 'POST',
        body: JSON.stringify({ force: true }),
        schema: AutoPostResultSchema,
      });
      if (result.generated === 0) {
        toast.error('Nothing to post — add a live item and a connected social first');
      } else {
        toast.success(
          `Wrote ${result.generated} draft${result.generated === 1 ? '' : 's'} — tap an icon to post`,
        );
        onGenerated();
        const refreshed = await apiFetch('/api/store/posts/auto', {
          schema: AutoPostSettingsSchema,
        });
        setSettings(refreshed);
      }
    } catch (error) {
      const body = error instanceof Error ? (error.cause as { errors?: { form?: string } }) : null;
      toast.error(body?.errors?.form ?? 'Could not generate drafts');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-2">
          <label htmlFor="auto-post-days" className="text-sm font-semibold">
            Posting rhythm
          </label>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger
              id="auto-post-days"
              className="rounded-md bg-card"
              aria-label="Posting rhythm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CADENCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {settings?.lastAt
              ? `Last batch ${formatDateTime(settings.lastAt)}`
              : 'Never generated yet'}
            {settings?.nextAt ? ` · next ${formatDateTime(settings.nextAt)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void saveCadence()}
            disabled={saving}
            variant="outline"
            className="h-10 rounded-md font-semibold"
          >
            {saving ? 'Saving…' : 'Save rhythm'}
          </Button>
          <Button
            type="button"
            onClick={() => void generateNow()}
            disabled={generating}
            className="h-10 rounded-md font-semibold"
          >
            {generating ? 'Writing…' : 'Generate now'}
          </Button>
        </div>
      </div>

      {posts === null ? (
        <p className="text-sm text-muted-foreground">Loading drafts…</p>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
          <p className="font-semibold">No ready drafts</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hit Generate now — we pick an item at random across your shelves and write one draft per
            connected network.
          </p>
        </div>
      ) : (
        <PublishLog posts={pending} onMarked={onMarked} onRemoved={onRemoved} />
      )}
    </div>
  );
}
