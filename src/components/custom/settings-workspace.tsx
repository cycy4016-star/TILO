// Settings: what an owner comes back to after setup — the social links, the
// storefront address, and pointers to the rest. Socials are optional in
// onboarding, so this screen is where a skipped step gets filled in later.
'use client';

import { Check, Copy, ExternalLink, Loader2, Save, Share2, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api-client';
import { SocialAccountList } from '@/lib/contracts/social';
import { StorePayload, type StorePayload as StoreRecord } from '@/lib/contracts/store';
import { SOCIAL_PLATFORM_DEFS, type SocialPlatformDef } from '@/lib/social';

type SocialRow = { platform: string; handle: string; url: string };

const emptyRows = () =>
  SOCIAL_PLATFORM_DEFS.map((entry) => ({ platform: entry.value, handle: '', url: '' }));

export function SettingsWorkspace() {
  const [store, setStore] = useState<StoreRecord | null>(null);
  const [rows, setRows] = useState<SocialRow[]>(emptyRows);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [storeResult, socialResult] = await Promise.all([
      apiFetch('/api/store', { schema: StorePayload }).catch(() => null),
      apiFetch('/api/store/socials', { schema: SocialAccountList }).catch(() => null),
    ]);
    if (storeResult) setStore(storeResult);
    if (socialResult) {
      const byPlatform = new Map(socialResult.items.map((item) => [item.platform, item]));
      setRows(
        SOCIAL_PLATFORM_DEFS.map((entry) => {
          const existing = byPlatform.get(entry.value);
          return {
            platform: entry.value,
            handle: existing?.handle ?? '',
            url: existing?.url ?? '',
          };
        }),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const storefrontUrl =
    store && typeof window !== 'undefined'
      ? `${window.location.origin}/store/${store.slug}`
      : store
        ? `/store/${store.slug}`
        : null;

  const connectedCount = rows.filter((row) => row.handle.trim()).length;

  function setField(platform: string, field: 'handle' | 'url', value: string) {
    setRows((current) =>
      current.map((row) => (row.platform === platform ? { ...row, [field]: value } : row)),
    );
  }

  async function copyLink() {
    if (!storefrontUrl) return;
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  }

  async function saveSocials() {
    const accounts = rows
      .filter((row) => row.handle.trim())
      .map((row) => ({
        platform: row.platform,
        handle: row.handle.trim(),
        url: row.url.trim() ? row.url.trim() : null,
      }));
    setSaving(true);
    try {
      await apiFetch('/api/store/socials', {
        method: 'PUT',
        body: JSON.stringify({ accounts }),
        schema: SocialAccountList,
      });
      toast.success(accounts.length > 0 ? 'Socials saved' : 'Socials cleared');
    } catch {
      toast.error('Could not save the socials — check the links are complete URLs');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />;
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-caption font-semibold text-primary">
          <Share2 aria-hidden className="size-3.5" /> Settings
        </span>
        <h1 className="mt-5 text-h1 font-display">
          Where customers <span className="text-primary">find you.</span>
        </h1>
        <p className="mt-2 max-w-md text-small text-muted-foreground">
          Your social links, your page address, and the account that runs it all.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-h3 font-display">Social links</h2>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              The networks customers already follow. Fill in a handle to connect one — leave the
              rest blank.{' '}
              {connectedCount === 0
                ? 'None connected yet, and that’s fine.'
                : `${connectedCount} connected.`}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {SOCIAL_PLATFORM_DEFS.map((entry: SocialPlatformDef) => {
            const row = rows.find((item) => item.platform === entry.value);
            if (!row) return null;
            const filled = Boolean(row.handle.trim());
            return (
              <div
                key={entry.value}
                className={`grid gap-3 rounded-xl border p-4 ${
                  filled ? 'border-primary/40 bg-primary/[0.04]' : 'border-border'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{entry.label}</p>
                    <p className="text-xs text-muted-foreground">{entry.hint}</p>
                  </div>
                  {filled && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-caption font-semibold text-primary">
                      <Check aria-hidden className="size-3" /> Connected
                    </span>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`social-${entry.value}-handle`} className="text-caption">
                      Handle
                    </Label>
                    <Input
                      id={`social-${entry.value}-handle`}
                      value={row.handle}
                      onChange={(event) => setField(entry.value, 'handle', event.target.value)}
                      placeholder={entry.value === 'WHATSAPP_STATUS' ? '024 000 0000' : '@handle'}
                      className="h-11 rounded-md"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`social-${entry.value}-url`} className="text-caption">
                      Profile link <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id={`social-${entry.value}-url`}
                      value={row.url}
                      onChange={(event) => setField(entry.value, 'url', event.target.value)}
                      placeholder="https://…"
                      inputMode="url"
                      className="h-11 rounded-md"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={saving}
            onClick={() => void saveSocials()}
            className="h-11 rounded-md px-6 font-semibold"
          >
            {saving ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Save aria-hidden className="size-4" />
            )}
            {saving ? 'Saving…' : 'Save socials'}
          </Button>
          <p className="text-xs text-muted-foreground">
            These appear as contact links on your public page.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 sm:p-7">
        <h2 className="text-h3 font-display">Your page</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The link customers open to browse and order.
        </p>
        {storefrontUrl ? (
          <>
            <p className="mt-4 break-all rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground">
              {storefrontUrl}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void copyLink()}
                className="h-9 rounded-md font-semibold"
              >
                <Copy aria-hidden className="size-4" /> {copied ? 'Copied!' : 'Copy link'}
              </Button>
              <Button asChild variant="outline" className="h-9 rounded-md font-semibold">
                <a href={storefrontUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden className="size-4" /> Open page
                </a>
              </Button>
              <Button asChild variant="ghost" className="h-9 rounded-md font-semibold">
                <Link href="/welcome">
                  Edit logo &amp; banner <ExternalLink aria-hidden className="size-4" />
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-4 text-small text-muted-foreground">
            Finish store setup to publish your link.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6 sm:p-7">
        <h2 className="text-h3 font-display">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your name, phone, password and profile picture.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline" className="h-10 rounded-md font-semibold">
            <Link href="/profile">
              <UserRound aria-hidden className="size-4" /> Manage account
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
