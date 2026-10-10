// Post-signup onboarding wizard: store info → socials (optional) → visuals →
// review. Each step saves through the same owner APIs the manager uses, so
// leaving mid-way never loses progress — the dashboard gate re-checks on entry.
// Socials can be skipped entirely and filled in later from Settings.
'use client';

import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  emptyImageSelection,
  ImagePicker,
  type ImageSelection,
} from '@/components/custom/image-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api-client';
import { useSession } from '@/lib/auth-client';
import { SocialAccountList } from '@/lib/contracts/social';
import { StorePayload, type StorePayload as StoreRecord } from '@/lib/contracts/store';
import { fitImageFile } from '@/lib/image';
import { SOCIAL_PLATFORM_DEFS, type SocialPlatformDef } from '@/lib/social';
import { uploadImageFile } from '@/lib/uploads';

const AvatarResult = z.object({ image: z.string().nullable() });

const SLUG_RULE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type SocialRow = { platform: string; handle: string; url: string };

const STEPS = ['Store info', 'Socials', 'Visuals', 'Review'];

export function OnboardingWizard() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState(0);
  const [store, setStore] = useState<StoreRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [phone, setPhone] = useState('');
  const [socials, setSocials] = useState<SocialRow[]>(
    SOCIAL_PLATFORM_DEFS.map((entry) => ({ platform: entry.value, handle: '', url: '' })),
  );
  const [logo, setLogo] = useState<ImageSelection>(emptyImageSelection);
  const [banner, setBanner] = useState<ImageSelection>(emptyImageSelection);
  const [avatar, setAvatar] = useState<ImageSelection>(emptyImageSelection);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch('/api/store', { schema: StorePayload }).catch(() => null),
      apiFetch('/api/store/socials', { schema: SocialAccountList }).catch(() => null),
    ]).then(([storeResult, socialResult]) => {
      if (cancelled) return;
      if (storeResult) {
        setStore(storeResult);
        setName(storeResult.name);
        setSlug(storeResult.slug);
        setTagline(storeResult.tagline ?? '');
        setPhone(storeResult.contactPhone ?? '');
      }
      if (socialResult) {
        const byPlatform = new Map(socialResult.items.map((item) => [item.platform, item]));
        setSocials(
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
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const image = session?.user?.image;
    if (typeof image === 'string' && image) setAvatarUrl(image);
  }, [session?.user?.image]);

  function setSocialField(platform: string, field: 'handle' | 'url', value: string) {
    setSocials((current) =>
      current.map((row) => (row.platform === platform ? { ...row, [field]: value } : row)),
    );
  }

  async function saveStoreInfo(): Promise<boolean> {
    if (!name.trim()) {
      toast.error('Give the store a name');
      return false;
    }
    if (!SLUG_RULE.test(slug.trim())) {
      toast.error('Link word: lowercase letters, numbers and dashes only');
      return false;
    }
    if (phone.replace(/\D/g, '').length < 9) {
      toast.error('Add a dialable phone number (at least 9 digits)');
      return false;
    }
    setSaving(true);
    try {
      const saved = await apiFetch('/api/store', {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          tagline: tagline.trim() ? tagline.trim() : undefined,
          contactPhone: phone.trim(),
          active: store?.active ?? true,
          theme: store?.theme,
          appearance: store?.appearance,
        }),
        schema: StorePayload,
      });
      setStore(saved);
      // Prefill the WhatsApp handle from the order number when empty.
      setSocials((current) =>
        current.map((row) =>
          row.platform === 'WHATSAPP_STATUS' && !row.handle.trim()
            ? { ...row, handle: phone.trim() }
            : row,
        ),
      );
      return true;
    } catch {
      toast.error('Could not save the store — is the link word taken?');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveSocials(): Promise<boolean> {
    const filled = socials
      .filter((row) => row.handle.trim())
      .map((row) => ({
        platform: row.platform,
        handle: row.handle.trim(),
        url: row.url.trim() ? row.url.trim() : null,
      }));
    // Socials are optional: an untouched step just advances. Anything the owner
    // did type is still saved, so partial work is never thrown away.
    if (filled.length === 0) return true;
    setSaving(true);
    try {
      await apiFetch('/api/store/socials', {
        method: 'PUT',
        body: JSON.stringify({ accounts: filled }),
        schema: SocialAccountList,
      });
      return true;
    } catch {
      toast.error('Could not save the socials');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveVisuals(): Promise<boolean> {
    if (!store) {
      toast.error('Save the store info first');
      return false;
    }
    const logoKept = store.hasLogo && !logo.cleared;
    const bannerKept = store.hasBanner && !banner.cleared;
    if (!logo.file && !banner.file && !logoKept && !bannerKept) {
      toast.error('Upload a logo or a banner so the page looks like you');
      return false;
    }
    setSaving(true);
    try {
      let saved = store;
      if (logo.file) {
        const compressed = await fitImageFile(logo.file, 'logo');
        saved = await uploadImageFile('/api/store/logo', compressed, logo.file.name, StorePayload);
      } else if (logo.cleared && saved.hasLogo) {
        saved = await apiFetch('/api/store/logo', { method: 'DELETE', schema: StorePayload });
      }
      if (banner.file) {
        const compressed = await fitImageFile(banner.file, 'banner');
        saved = await uploadImageFile(
          '/api/store/banner',
          compressed,
          banner.file.name,
          StorePayload,
        );
      } else if (banner.cleared && saved.hasBanner) {
        saved = await apiFetch('/api/store/banner', { method: 'DELETE', schema: StorePayload });
      }
      if (avatar.file) {
        const compressed = await fitImageFile(avatar.file, 'avatar', 0.85);
        const result = await uploadImageFile(
          '/api/profile/image',
          compressed,
          avatar.file.name,
          AvatarResult,
        );
        setAvatarUrl(result.image);
        setAvatar(emptyImageSelection);
      }
      setStore(saved);
      return true;
    } catch {
      toast.error('Could not save the visuals');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    if (step === 0 && (await saveStoreInfo())) setStep(1);
    else if (step === 1 && (await saveSocials())) setStep(2);
    else if (step === 2 && (await saveVisuals())) setStep(3);
  }

  function finish() {
    router.push('/dashboard');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-caption font-medium text-muted-foreground">
        Getting your shop ready…
      </div>
    );
  }

  const firstName = session?.user?.name?.split(' ')[0] ?? 'Chief';
  const connectedSocials = socials.filter((row) => row.handle.trim()).length;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="text-eyebrow">Welcome, {firstName}</p>
      <h1 className="mt-3 font-display text-h1">Set up your shop.</h1>
      <p className="mt-2 max-w-[52ch] text-body text-muted-foreground">
        Four quick steps — your page goes live the moment the first one saves.
      </p>

      <ol className="mt-6 flex items-center gap-2" aria-label="Setup progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              aria-current={index === step ? 'step' : undefined}
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-caption font-semibold ${
                index < step
                  ? 'bg-primary text-primary-foreground'
                  : index === step
                    ? 'border border-primary/50 bg-primary/10 text-primary'
                    : 'border border-border text-muted-foreground'
              }`}
            >
              {index < step ? <Check aria-hidden className="size-4" /> : index + 1}
            </span>
            <span
              className={`hidden text-caption font-medium sm:block ${index === step ? '' : 'text-muted-foreground'}`}
            >
              {label}
            </span>
            {index < STEPS.length - 1 && <span aria-hidden className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-8">
        {step === 0 && (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ob-name">Store name</Label>
                <Input
                  id="ob-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ama's Boutique"
                  className="h-11 rounded-md"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ob-slug">Link word</Label>
                <Input
                  id="ob-slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="amas-boutique"
                  className="h-11 rounded-md font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Your page lives at /store/
                  <span className="font-mono">{slug.trim() || '…'}</span>
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ob-tagline">Tagline</Label>
              <Input
                id="ob-tagline"
                value={tagline}
                onChange={(event) => setTagline(event.target.value)}
                placeholder="Printed gear, made in Accra"
                className="h-11 rounded-md"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ob-phone">WhatsApp number for orders</Label>
              <Input
                id="ob-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="024 000 0000"
                className="h-11 rounded-md"
              />
              <p className="text-xs text-muted-foreground">
                Every “order” button opens a chat with this number.
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-small text-muted-foreground">
                Where else customers find you. Add as many as you like — or none.
              </p>
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-caption font-semibold text-muted-foreground">
                Optional
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              You can connect or change these anytime in{' '}
              <span className="font-semibold text-foreground">Settings</span> — skipping won&apos;t
              hold up your page.
            </p>
            {SOCIAL_PLATFORM_DEFS.map((entry: SocialPlatformDef) => (
              <div key={entry.value} className="grid gap-2 rounded-xl border border-border p-4">
                <p className="text-sm font-semibold">{entry.label}</p>
                <p className="text-xs text-muted-foreground">{entry.hint}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={socials.find((row) => row.platform === entry.value)?.handle ?? ''}
                    onChange={(event) => setSocialField(entry.value, 'handle', event.target.value)}
                    placeholder={entry.value === 'WHATSAPP_STATUS' ? '024 000 0000' : '@handle'}
                    aria-label={`${entry.label} handle`}
                    className="h-11 rounded-md"
                  />
                  <Input
                    value={socials.find((row) => row.platform === entry.value)?.url ?? ''}
                    onChange={(event) => setSocialField(entry.value, 'url', event.target.value)}
                    placeholder="Profile link (optional)"
                    aria-label={`${entry.label} link`}
                    className="h-11 rounded-md"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label>Store logo</Label>
              <ImagePicker
                currentUrl={
                  store?.hasLogo
                    ? `/api/public/store/${store.slug}/logo?t=${Date.parse(store.updatedAt)}`
                    : null
                }
                value={logo}
                onChange={setLogo}
              />
            </div>
            <div className="grid gap-2">
              <Label>Store banner</Label>
              <ImagePicker
                currentUrl={
                  store?.hasBanner
                    ? `/api/public/store/${store.slug}/banner?t=${Date.parse(store.updatedAt)}`
                    : null
                }
                value={banner}
                onChange={setBanner}
              />
              <p className="text-xs text-muted-foreground">
                A wide photo across the top of your public page — your shopfront, your best shelf,
                your team.
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Your profile picture</Label>
              <ImagePicker
                currentUrl={avatarUrl}
                value={avatar}
                onChange={setAvatar}
                shape="circle"
              />
              <p className="text-xs text-muted-foreground">Optional — customers never see it.</p>
            </div>
          </div>
        )}

        {step === 3 && store && (
          <div className="grid gap-4">
            <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/40 p-4">
              {store.hasLogo ? (
                <img
                  src={`/api/public/store/${store.slug}/logo?t=${Date.parse(store.updatedAt)}`}
                  alt=""
                  className="size-14 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-h3 text-primary">
                  {store.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-display text-h4">{store.name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  /store/{store.slug} · {store.contactPhone}
                </p>
              </div>
            </div>
            <ul className="grid gap-2 text-small">
              {[
                { label: 'Store info', done: true },
                {
                  label:
                    connectedSocials > 0
                      ? `${connectedSocials} ${connectedSocials === 1 ? 'social' : 'socials'} connected`
                      : 'Socials skipped — add them in Settings',
                  done: connectedSocials > 0,
                },
                {
                  label: store.hasLogo || store.hasBanner ? 'Logo & banner ready' : 'Visuals ready',
                  done: true,
                },
              ].map((entry) => (
                <li key={entry.label} className="flex items-center gap-2">
                  <span
                    className={`flex size-6 items-center justify-center rounded-full ${
                      entry.done ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {entry.done ? (
                      <Check aria-hidden className="size-3.5" />
                    ) : (
                      <span aria-hidden className="size-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <span className={entry.done ? '' : 'text-muted-foreground'}>{entry.label}</span>
                </li>
              ))}
            </ul>
            <p className="text-small text-muted-foreground">
              Add products next — your page is already live at the link above.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0 || saving}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            className="h-11 w-full rounded-md font-semibold sm:w-auto"
          >
            <ArrowLeft aria-hidden className="size-4" /> Back
          </Button>
          {step === 1 && (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setStep(2)}
              className="h-11 w-full rounded-md font-semibold sm:w-auto"
            >
              Skip for now
            </Button>
          )}
          {step < 3 ? (
            <Button
              type="button"
              disabled={saving}
              onClick={() => void next()}
              className="h-11 w-full rounded-md px-6 font-semibold sm:w-auto"
            >
              {saving ? 'Saving…' : 'Save & continue'} <ArrowRight aria-hidden className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={finish}
              className="h-11 w-full rounded-md px-6 font-semibold sm:w-auto"
            >
              Open your dashboard <ArrowRight aria-hidden className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
