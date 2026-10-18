// Post-signup onboarding wizard: store info → socials (optional) → visuals →
// review. Each step saves through the same owner APIs the manager uses, so
// leaving mid-way never loses progress — and reopening the wizard resumes at
// the furthest completed step. Socials can be skipped entirely and filled in
// later from Settings.
'use client';

import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
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
import { SlugCheck, StorePayload, type StorePayload as StoreRecord } from '@/lib/contracts/store';
import { fitImageFile } from '@/lib/image';
import { isValidSlug, slugify } from '@/lib/slug';
import { SOCIAL_PLATFORM_DEFS, type SocialPlatformDef } from '@/lib/social';
import { uploadImageFile } from '@/lib/uploads';

const AvatarResult = z.object({ image: z.string().nullable() });

const SLUG_HINT = 'Use lowercase letters, numbers and dashes (min 2 characters)';

type SocialRow = { platform: string; handle: string; url: string };
type FieldName = 'name' | 'slug' | 'phone';
type SlugCheckState = {
  status: 'idle' | 'checking' | 'available' | 'taken';
  suggestion: string | null;
};

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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [slugCheck, setSlugCheck] = useState<SlugCheckState>({
    status: 'idle',
    suggestion: null,
  });
  // Once the owner edits the link word by hand, the store name stops
  // rewriting it. A ref so typing never re-renders just for this flag.
  const slugTouched = useRef(false);
  // Monotonic sequence: only the newest availability response may set state,
  // so a slow reply for an old slug can't overwrite a newer verdict.
  const slugCheckSeq = useRef(0);

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
      // Resume where the owner left off: no usable identity → step 0;
      // identity but no visuals → step 1 (one more shot at socials on the
      // way); otherwise straight to Review.
      const hasPhone = (storeResult?.contactPhone ?? '').replace(/\D/g, '').length >= 9;
      const hasVisuals = !!storeResult && (storeResult.hasLogo || storeResult.hasBanner);
      setStep(!storeResult || !hasPhone ? 0 : !hasVisuals ? 1 : 3);
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

  const trimmedSlug = slug.trim();

  // Debounced availability check: catching a taken link word before Save is
  // the whole point, so the verdict (and a free suggestion) appears inline.
  useEffect(() => {
    if (!trimmedSlug || !isValidSlug(trimmedSlug)) {
      setSlugCheck({ status: 'idle', suggestion: null });
      return;
    }
    if (store?.slug === trimmedSlug) {
      setSlugCheck({ status: 'available', suggestion: null });
      return;
    }
    setSlugCheck({ status: 'checking', suggestion: null });
    slugCheckSeq.current += 1;
    const seq = slugCheckSeq.current;
    const timer = window.setTimeout(() => {
      apiFetch(`/api/store/slug-check?slug=${encodeURIComponent(trimmedSlug)}`, {
        schema: SlugCheck,
      })
        .then((result) => {
          if (slugCheckSeq.current !== seq) return;
          setSlugCheck({
            status: result.available ? 'available' : 'taken',
            suggestion: result.suggestion,
          });
        })
        .catch(() => {
          if (slugCheckSeq.current !== seq) return;
          // No verdict (offline, hiccup): let Save decide — the server still
          // owns uniqueness and mirrors a 409 back inline.
          setSlugCheck({ status: 'idle', suggestion: null });
        });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [trimmedSlug, store]);

  function clearFieldError(field: FieldName) {
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }

  function handleNameChange(value: string) {
    setName(value);
    clearFieldError('name');
    // The link word follows the name until the owner touches it directly.
    if (!slugTouched.current) setSlug(slugify(value));
  }

  function handleSlugChange(value: string) {
    slugTouched.current = true;
    setSlug(value);
    clearFieldError('slug');
  }

  function applySuggestion() {
    if (!slugCheck.suggestion) return;
    slugTouched.current = true;
    setSlug(slugCheck.suggestion);
    clearFieldError('slug');
    document.getElementById('ob-slug')?.focus();
  }

  function setSocialField(platform: string, field: 'handle' | 'url', value: string) {
    setSocials((current) =>
      current.map((row) => (row.platform === platform ? { ...row, [field]: value } : row)),
    );
  }

  async function saveStoreInfo(): Promise<boolean> {
    const problems: Partial<Record<FieldName, string>> = {};
    if (!name.trim()) problems.name = 'Give the store a name';
    if (!isValidSlug(slug.trim())) {
      problems.slug = SLUG_HINT;
    } else if (slugCheck.status === 'taken') {
      problems.slug = 'That link word is already taken — try the suggestion';
    }
    if (phone.replace(/\D/g, '').length < 9) {
      problems.phone = 'Add a number customers can reach (9+ digits)';
    }
    setFieldErrors(problems);
    const firstInvalid = (['name', 'slug', 'phone'] as const).find((field) => problems[field]);
    if (firstInvalid) {
      document.getElementById(`ob-${firstInvalid}`)?.focus();
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
      setSlugCheck({ status: 'available', suggestion: null });
      toast.success('Your page is live', {
        description: `/store/${saved.slug} — share the link anywhere.`,
      });
      // Prefill the WhatsApp handle from the order number when empty.
      setSocials((current) =>
        current.map((row) =>
          row.platform === 'WHATSAPP_STATUS' && !row.handle.trim()
            ? { ...row, handle: phone.trim() }
            : row,
        ),
      );
      return true;
    } catch (error) {
      // The server owns slug uniqueness: mirror its field errors inline
      // (409 "taken", 400 format) instead of a generic toast.
      const serverErrors = (error as { cause?: { errors?: Record<string, string> } }).cause?.errors;
      const inline: Partial<Record<FieldName, string>> = {};
      if (serverErrors?.slug) {
        inline.slug = serverErrors.slug;
        setSlugCheck({ status: 'taken', suggestion: null });
      }
      if (serverErrors?.name) inline.name = serverErrors.name;
      if (inline.slug || inline.name) {
        setFieldErrors(inline);
        document.getElementById(inline.slug ? 'ob-slug' : 'ob-name')?.focus();
      } else {
        toast.error('Could not save the store — check your connection and try again');
      }
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
        const compressed = await fitImageFile(logo.file, 'logo', 0.82, 'contain');
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

  async function copyStoreLink() {
    if (!store) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/store/${store.slug}`);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy — long-press the link instead');
    }
  }

  function finish() {
    toast.success('Shop set up — add your first product', {
      description: 'Your shelf is waiting inside the catalogue.',
    });
    // Land on the catalogue, scrolled to the shelf, so the very next tap
    // fills the empty page the owner just went live with.
    router.push('/dashboard/store#the-shelf');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl animate-pulse" aria-busy="true">
        <div className="h-3 w-32 rounded bg-muted" />
        <div className="mt-3 h-9 w-72 rounded bg-muted" />
        <div className="mt-2 h-4 w-56 rounded bg-muted" />
        <div className="mt-6 flex items-center gap-2">
          {STEPS.map((label) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div className="size-8 shrink-0 rounded-full bg-muted" />
              <div className="h-px flex-1 bg-muted" />
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-8">
          <div className="grid gap-4">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-11 rounded-md bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-11 rounded-md bg-muted" />
            <div className="h-11 w-40 rounded-md bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  const firstName = session?.user?.name?.split(' ')[0] ?? 'Chief';
  const connectedSocials = socials.filter((row) => row.handle.trim()).length;

  let slugHint: ReactNode;
  if (fieldErrors.slug) {
    slugHint = <p className="text-caption text-destructive">{fieldErrors.slug}</p>;
  } else if (!trimmedSlug) {
    slugHint = (
      <p className="text-caption text-muted-foreground">
        Your page lives at /store/<span className="font-mono">…</span>
      </p>
    );
  } else if (!isValidSlug(trimmedSlug)) {
    slugHint = <p className="text-caption text-muted-foreground">{SLUG_HINT}</p>;
  } else if (store?.slug === trimmedSlug) {
    slugHint = (
      <p className="text-caption text-muted-foreground">
        Your page is live at{' '}
        <a
          href={`/store/${store.slug}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono font-semibold text-primary underline underline-offset-2"
        >
          /store/{store.slug} <ExternalLink aria-hidden className="inline size-3" />
        </a>
      </p>
    );
  } else if (slugCheck.status === 'checking') {
    slugHint = (
      <p className="text-caption text-muted-foreground">
        Checking /store/<span className="font-mono">{trimmedSlug}</span>…
      </p>
    );
  } else if (slugCheck.status === 'available') {
    slugHint = (
      <p className="text-caption font-medium text-primary">
        <Check aria-hidden className="inline size-3.5" /> /store/{trimmedSlug} is yours
      </p>
    );
  } else if (slugCheck.status === 'taken') {
    slugHint = (
      <p className="flex flex-wrap items-center gap-x-1.5 text-caption text-destructive">
        /store/{trimmedSlug} is taken.
        {slugCheck.suggestion && (
          <button
            type="button"
            onClick={applySuggestion}
            className="font-semibold underline underline-offset-2"
          >
            Use {slugCheck.suggestion}
          </button>
        )}
      </p>
    );
  } else {
    slugHint = (
      <p className="text-caption text-muted-foreground">
        Your page lives at /store/<span className="font-mono">{trimmedSlug}</span>
      </p>
    );
  }

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
              className={`hidden text-caption sm:block ${
                index === step
                  ? 'font-semibold text-foreground'
                  : 'font-medium text-muted-foreground'
              }`}
            >
              {label}
            </span>
            {index < STEPS.length - 1 && (
              <span
                aria-hidden
                className={`h-px flex-1 ${index < step ? 'bg-primary/40' : 'bg-border'}`}
              />
            )}
          </li>
        ))}
      </ol>

      <form
        className="mt-6 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-8"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (step < 3) void next();
          else finish();
        }}
      >
        {step === 0 && (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ob-name">Store name</Label>
                <Input
                  id="ob-name"
                  value={name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  onBlur={() => {
                    if (!name.trim()) {
                      setFieldErrors((current) => ({ ...current, name: 'Give the store a name' }));
                    }
                  }}
                  placeholder="Ama's Boutique"
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? 'ob-name-error' : undefined}
                  className="h-11 rounded-md"
                />
                {fieldErrors.name && (
                  <p id="ob-name-error" className="text-caption text-destructive">
                    {fieldErrors.name}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ob-slug">Link word</Label>
                <Input
                  id="ob-slug"
                  value={slug}
                  onChange={(event) => handleSlugChange(event.target.value)}
                  onBlur={() => {
                    const value = slug.trim();
                    if (value && !isValidSlug(value)) {
                      setFieldErrors((current) => ({ ...current, slug: SLUG_HINT }));
                    }
                  }}
                  placeholder="amas-boutique"
                  aria-invalid={!!fieldErrors.slug}
                  aria-describedby="ob-slug-hint"
                  className="h-11 rounded-md font-mono"
                />
                <div id="ob-slug-hint" aria-live="polite">
                  {slugHint}
                </div>
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
                onChange={(event) => {
                  setPhone(event.target.value);
                  clearFieldError('phone');
                }}
                onBlur={() => {
                  if (phone.replace(/\D/g, '').length < 9) {
                    setFieldErrors((current) => ({
                      ...current,
                      phone: 'Add a number customers can reach (9+ digits)',
                    }));
                  }
                }}
                placeholder="024 000 0000"
                aria-invalid={!!fieldErrors.phone}
                aria-describedby={fieldErrors.phone ? 'ob-phone-error' : 'ob-phone-hint'}
                className="h-11 rounded-md"
              />
              {fieldErrors.phone ? (
                <p id="ob-phone-error" className="text-caption text-destructive">
                  {fieldErrors.phone}
                </p>
              ) : (
                <p id="ob-phone-hint" className="text-caption text-muted-foreground">
                  Every “order” button opens a chat with this number.
                </p>
              )}
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
            <p className="text-caption text-muted-foreground">
              You can connect or change these anytime in{' '}
              <span className="font-semibold text-foreground">Settings</span> — skipping won&apos;t
              hold up your page.
            </p>
            {SOCIAL_PLATFORM_DEFS.map((entry: SocialPlatformDef) => (
              <div key={entry.value} className="grid gap-2 rounded-xl border border-border p-4">
                <p className="text-caption font-semibold">{entry.label}</p>
                <p className="text-caption text-muted-foreground">{entry.hint}</p>
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
                fit="contain"
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
              <p className="text-caption text-muted-foreground">
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
              <p className="text-caption text-muted-foreground">
                Optional — customers never see it.
              </p>
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
                  className="size-14 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-black/5"
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
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" className="h-10 rounded-md font-semibold">
                <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer">
                  Open your page <ExternalLink aria-hidden className="size-4" />
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-md font-semibold"
                onClick={() => void copyStoreLink()}
              >
                <Copy aria-hidden className="size-4" /> Copy link
              </Button>
              <Button asChild variant="outline" className="h-10 rounded-md font-semibold">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Check out ${store.name} on Tilza: ${window.location.origin}/store/${store.slug}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle aria-hidden className="size-4" /> Share on WhatsApp
                </a>
              </Button>
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
              Your page is already live. Next: add your first product so the shelf isn&apos;t empty.
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
              type="submit"
              disabled={saving}
              className="h-11 w-full rounded-md px-6 font-semibold sm:w-auto"
            >
              {saving ? 'Saving…' : 'Save & continue'} <ArrowRight aria-hidden className="size-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={saving}
              className="h-11 w-full rounded-md px-6 font-semibold sm:w-auto"
            >
              Next: add your first product <ArrowRight aria-hidden className="size-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
