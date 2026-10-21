'use client';

import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Facebook,
  ImagePlus,
  Instagram,
  type LucideIcon,
  MessageCircle,
  Music2,
  Pencil,
  Plus,
  Sparkles,
  Store,
  Wand2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  emptyImageSelection,
  ImagePicker,
  type ImageSelection,
} from '@/components/custom/image-picker';
import { ShopPreview, ShopPreviewChip } from '@/components/custom/onboarding/shop-preview';
import { TilzaLogo } from '@/components/custom/tilza-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api-client';
import { useSession } from '@/lib/auth-client';
import { SocialAccountList, type SocialPlatformValue } from '@/lib/contracts/social';
import { SlugCheck, StorePayload, type StorePayload as StoreRecord } from '@/lib/contracts/store';
import { fitImageFile } from '@/lib/image';
import {
  DEFAULT_SHOP_LOOK,
  renderShopVisuals,
  SHOP_LOOKS,
  type ShopLookKey,
  shopInitials,
  shopPath,
  suggestShopNames,
} from '@/lib/shop-brand';
import { isValidSlug, slugify } from '@/lib/slug';
import { SOCIAL_PLATFORM_DEFS } from '@/lib/social';
import { uploadImageFile } from '@/lib/uploads';
import { cn } from '@/lib/utils';

const AvatarResult = z.object({ image: z.string().nullable() });
const SLUG_HINT = 'Use lowercase letters, numbers and dashes (min 2 characters)';
const TAGLINE_IDEAS = ['Made with love in Accra', 'Small shop, big finds', 'Order on WhatsApp'];

type SocialRow = { platform: SocialPlatformValue; handle: string; url: string };
type FieldName = 'name' | 'slug' | 'phone';
type SlugCheckState = {
  status: 'idle' | 'checking' | 'available' | 'taken';
  suggestion: string | null;
};
type VisualMode = 'auto' | 'keep' | 'upload';

const STEPS: { label: string; icon: LucideIcon }[] = [
  { label: 'Name', icon: Store },
  { label: 'WhatsApp', icon: MessageCircle },
  { label: 'Look', icon: Sparkles },
  { label: 'Socials', icon: AtSign },
  { label: 'Open', icon: BadgeCheck },
];

const SOCIAL_ICONS: Record<SocialPlatformValue, LucideIcon> = {
  TIKTOK: Music2,
  INSTAGRAM: Instagram,
  FACEBOOK_PAGE: Facebook,
  WHATSAPP_STATUS: MessageCircle,
};

const SOCIAL_TINTS: Record<SocialPlatformValue, string> = {
  TIKTOK: 'bg-foreground text-background',
  INSTAGRAM: 'bg-gradient-to-br from-pink-500 via-rose-500 to-amber-400 text-white',
  FACEBOOK_PAGE: 'bg-blue-600 text-white',
  WHATSAPP_STATUS: 'bg-emerald-500 text-white',
};

const CONFETTI = Array.from({ length: 26 }, (_, index) => ({
  id: `confetti-${index}`,
  left: `${(index * 37 + 9) % 100}%`,
  delay: `${(index % 7) * 0.11}s`,
  duration: `${2.1 + (index % 5) * 0.18}s`,
  color: ['#fb7701', '#c81e1e', '#0f766e', '#4f46e5', '#f59e0b'][index % 5] as string,
  rotate: `${(index * 29) % 180}deg`,
}));

function StepProgress({ step }: { step: number }) {
  return (
    <div
      className="grid grid-cols-5 gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={STEPS.length}
      aria-valuenow={step + 1}
      aria-label={`Shop setup progress, step ${step + 1} of ${STEPS.length}`}
    >
      {STEPS.map((entry, index) => (
        <span
          key={entry.label}
          className={cn(
            'h-1.5 rounded-full transition-colors duration-300',
            index <= step ? 'bg-primary' : 'bg-muted',
          )}
        />
      ))}
    </div>
  );
}

function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {CONFETTI.map((piece) => (
        <span
          key={piece.id}
          className="onboarding-confetti absolute top-0 block h-2.5 w-1.5 rounded-[1px]"
          style={{
            left: piece.left,
            backgroundColor: piece.color,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            transform: `rotate(${piece.rotate})`,
          }}
        />
      ))}
    </div>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState(0);
  const [store, setStore] = useState<StoreRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [phone, setPhone] = useState('');
  const [socials, setSocials] = useState<SocialRow[]>(
    SOCIAL_PLATFORM_DEFS.map((entry) => ({ platform: entry.value, handle: '', url: '' })),
  );
  const [activeSocials, setActiveSocials] = useState<Set<SocialPlatformValue>>(new Set());
  const [logo, setLogo] = useState<ImageSelection>(emptyImageSelection);
  const [banner, setBanner] = useState<ImageSelection>(emptyImageSelection);
  const [avatar, setAvatar] = useState<ImageSelection>(emptyImageSelection);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [lookKey, setLookKey] = useState<ShopLookKey>(DEFAULT_SHOP_LOOK);
  const [visualMode, setVisualMode] = useState<VisualMode>('auto');
  const [showCustomVisuals, setShowCustomVisuals] = useState(false);
  const [showTagline, setShowTagline] = useState(false);
  const [showLink, setShowLink] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [slugCheck, setSlugCheck] = useState<SlugCheckState>({
    status: 'idle',
    suggestion: null,
  });
  const slugTouched = useRef(false);
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
        slugTouched.current = true;
        const hasVisual = storeResult.hasLogo || storeResult.hasBanner;
        setVisualMode(hasVisual ? 'keep' : 'auto');
      } else {
        setVisualMode('auto');
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
        setActiveSocials(new Set(socialResult.items.map((item) => item.platform)));
      }
      const hasPhone = (storeResult?.contactPhone ?? '').replace(/\D/g, '').length >= 9;
      const hasVisual = Boolean(storeResult && (storeResult.hasLogo || storeResult.hasBanner));
      setStep(!storeResult || !hasPhone ? 0 : !hasVisual ? 2 : 4);
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

  useEffect(() => {
    if (!logo.file) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(logo.file);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo.file]);

  useEffect(() => {
    if (!banner.file) {
      setBannerPreview(null);
      return;
    }
    const url = URL.createObjectURL(banner.file);
    setBannerPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [banner.file]);

  const trimmedSlug = slug.trim();

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
          setSlugCheck({ status: 'idle', suggestion: null });
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [trimmedSlug, store]);

  const firstName = session?.user?.name?.trim().split(/\s+/)[0] ?? '';
  const nameIdeas = useMemo(() => suggestShopNames(firstName), [firstName]);
  const activeSocialCount = useMemo(
    () =>
      socials.filter((row) => activeSocials.has(row.platform) && row.handle.trim().length > 0)
        .length,
    [activeSocials, socials],
  );
  const displayInitial = shopInitials(name || 'Your shop');

  const currentLogoUrl =
    logoPreview ??
    (visualMode !== 'auto' && store?.hasLogo
      ? `/api/public/store/${store.slug}/logo?t=${Date.parse(store.updatedAt)}`
      : null);
  const currentBannerUrl =
    bannerPreview ??
    (visualMode !== 'auto' && store?.hasBanner
      ? `/api/public/store/${store.slug}/banner?t=${Date.parse(store.updatedAt)}`
      : null);

  function clearFieldError(field: FieldName) {
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }

  function handleNameChange(value: string) {
    setName(value);
    clearFieldError('name');
    if (!slugTouched.current) setSlug(slugify(value));
  }

  function handleSlugChange(value: string) {
    slugTouched.current = true;
    setSlug(value);
    clearFieldError('slug');
  }

  function applyNameIdea(value: string) {
    setName(value);
    clearFieldError('name');
    if (!slugTouched.current) setSlug(slugify(value));
  }

  function applySuggestion() {
    if (!slugCheck.suggestion) return;
    slugTouched.current = true;
    setSlug(slugCheck.suggestion);
    clearFieldError('slug');
    document.getElementById('ob-slug')?.focus();
  }

  function chooseLook(key: ShopLookKey) {
    setLookKey(key);
    setVisualMode('auto');
    setShowCustomVisuals(false);
    setLogo(emptyImageSelection);
    setBanner(emptyImageSelection);
  }

  function pickLogo(next: ImageSelection) {
    setLogo(next);
    if (next.file || next.cleared) setVisualMode('upload');
  }

  function pickBanner(next: ImageSelection) {
    setBanner(next);
    if (next.file || next.cleared) setVisualMode('upload');
  }

  function toggleSocial(platform: SocialPlatformValue) {
    const isActive = activeSocials.has(platform);
    if (isActive) {
      setActiveSocials((current) => {
        const next = new Set(current);
        next.delete(platform);
        return next;
      });
      return;
    }
    setActiveSocials((current) => new Set(current).add(platform));
    if (platform === 'WHATSAPP_STATUS' && phone.trim()) {
      setSocials((current) =>
        current.map((row) =>
          row.platform === platform && !row.handle.trim() ? { ...row, handle: phone.trim() } : row,
        ),
      );
    }
    requestAnimationFrame(() => document.getElementById(`ob-social-${platform}`)?.focus());
  }

  function setSocialField(platform: SocialPlatformValue, field: 'handle', value: string) {
    setSocials((current) =>
      current.map((row) => (row.platform === platform ? { ...row, [field]: value } : row)),
    );
  }

  function validateIdentity(): boolean {
    const problems: Partial<Record<FieldName, string>> = {};
    if (!name.trim()) problems.name = 'Give your shop a name';
    if (!isValidSlug(trimmedSlug)) {
      problems.slug = SLUG_HINT;
    } else if (slugCheck.status === 'taken') {
      problems.slug = 'That link is taken — try the suggestion';
    }
    setFieldErrors(problems);
    if (problems.slug) setShowLink(true);
    const firstInvalid = (['name', 'slug'] as const).find((field) => problems[field]);
    if (firstInvalid) {
      document.getElementById(`ob-${firstInvalid}`)?.focus();
      return false;
    }
    return true;
  }

  function validatePhone(): boolean {
    if (phone.replace(/\D/g, '').length < 9) {
      setFieldErrors((current) => ({
        ...current,
        phone: 'Add a number customers can reach (9+ digits)',
      }));
      document.getElementById('ob-phone')?.focus();
      return false;
    }
    clearFieldError('phone');
    return true;
  }

  async function saveStoreInfo(): Promise<boolean> {
    if (!validateIdentity()) return false;
    if (!validatePhone()) return false;
    setSaving(true);
    try {
      const wasNew = !store;
      const saved = await apiFetch('/api/store', {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          slug: trimmedSlug,
          tagline: tagline.trim() ? tagline.trim() : undefined,
          contactPhone: phone.trim(),
          active: store?.active ?? true,
          theme: store?.theme,
          appearance: store?.appearance,
        }),
        schema: StorePayload,
      });
      setStore(saved);
      slugTouched.current = true;
      setSlugCheck({ status: 'available', suggestion: null });
      setSocials((current) =>
        current.map((row) =>
          row.platform === 'WHATSAPP_STATUS' && !row.handle.trim()
            ? { ...row, handle: phone.trim() }
            : row,
        ),
      );
      toast.success(wasNew ? 'Shop saved. Now pick a look.' : 'Shop details saved', {
        description: shopPath(saved.slug),
      });
      return true;
    } catch (error) {
      const serverErrors = (error as { cause?: { errors?: Record<string, string> } }).cause?.errors;
      const inline: Partial<Record<FieldName, string>> = {};
      if (serverErrors?.slug) {
        inline.slug = serverErrors.slug;
        setSlugCheck({ status: 'taken', suggestion: null });
        setShowLink(true);
      }
      if (serverErrors?.name) inline.name = serverErrors.name;
      if (serverErrors?.contactPhone) inline.phone = serverErrors.contactPhone;
      if (inline.slug || inline.name || inline.phone) {
        setFieldErrors(inline);
        const field = inline.name ? 'name' : inline.slug ? 'slug' : 'phone';
        document.getElementById(`ob-${field}`)?.focus();
      } else {
        toast.error('Could not save your shop — check your connection and try again');
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveVisuals(): Promise<boolean> {
    if (!store) {
      toast.error('Save your shop details first');
      return false;
    }
    const hasCustomChange = Boolean(logo.file || banner.file || logo.cleared || banner.cleared);
    const keepsLogo = Boolean(logo.file) || (store.hasLogo && !logo.cleared);
    const keepsBanner = Boolean(banner.file) || (store.hasBanner && !banner.cleared);
    if (hasCustomChange && !keepsLogo && !keepsBanner) {
      toast.error('Keep at least one image, or tap a look instead');
      return false;
    }
    setSaving(true);
    try {
      let saved = store;
      if (hasCustomChange) {
        if (logo.file) {
          const compressed = await fitImageFile(logo.file, 'logo', 0.82, 'contain');
          saved = await uploadImageFile(
            '/api/store/logo',
            compressed,
            logo.file.name,
            StorePayload,
          );
        } else if (logo.cleared && saved.hasLogo) {
          saved = await apiFetch('/api/store/logo', { method: 'DELETE', schema: StorePayload });
        }
        setStore(saved);
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
      } else if (visualMode === 'auto' || (!saved.hasLogo && !saved.hasBanner)) {
        const generated = await renderShopVisuals(lookKey, name.trim(), tagline.trim());
        saved = await uploadImageFile(
          '/api/store/logo',
          generated.logo,
          generated.logo.name,
          StorePayload,
        );
        setStore(saved);
        saved = await uploadImageFile(
          '/api/store/banner',
          generated.banner,
          generated.banner.name,
          StorePayload,
        );
        setVisualMode('keep');
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
      toast.error('Could not save your look — try again or upload a photo');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveSocials(): Promise<boolean> {
    if (!store) {
      toast.error('Save your shop details first');
      return false;
    }
    const selectedRows = socials.filter(
      (row) => activeSocials.has(row.platform) && row.handle.trim().length > 0,
    );
    const emptySelected = [...activeSocials].filter(
      (platform) => !socials.find((row) => row.platform === platform)?.handle.trim(),
    );
    if (emptySelected.length > 0) {
      toast.error('Add a handle, or tap the network again to skip it');
      return false;
    }
    setSaving(true);
    try {
      const saved = await apiFetch('/api/store/socials', {
        method: 'PUT',
        body: JSON.stringify({
          accounts: selectedRows.map((row) => ({
            platform: row.platform,
            handle: row.handle.trim(),
            url: row.url.trim() ? row.url.trim() : null,
          })),
        }),
        schema: SocialAccountList,
      });
      const savedPlatforms = new Set(saved.items.map((item) => item.platform));
      setActiveSocials(savedPlatforms);
      return true;
    } catch {
      toast.error('Could not save your socials — try again or skip for now');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    if (saving) return;
    if (step === 0) {
      if (validateIdentity()) setStep(1);
      return;
    }
    if (step === 1) {
      if (await saveStoreInfo()) setStep(2);
      return;
    }
    if (step === 2) {
      if (await saveVisuals()) setStep(3);
      return;
    }
    if (step === 3) {
      if (await saveSocials()) setStep(4);
    }
  }

  function skipSocials() {
    if (!saving) setStep(4);
  }

  async function copyStoreLink() {
    if (!store) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${shopPath(store.slug)}`);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy — long-press the link instead');
    }
  }

  function shareOnWhatsApp() {
    if (!store) return;
    const url = `${window.location.origin}${shopPath(store.slug)}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`Check out ${store.name} on Tilza: ${url}`)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  function finish() {
    toast.success(store?.items.length ? 'Back to your shop' : 'Shop set up — add your first item', {
      description: 'Your shelf is waiting inside the catalogue.',
    });
    router.push('/dashboard/store#the-shelf');
    router.refresh();
  }

  let slugHint: ReactNode;
  if (fieldErrors.slug) {
    slugHint = <p className="text-caption text-destructive">{fieldErrors.slug}</p>;
  } else if (!trimmedSlug) {
    slugHint = (
      <p className="text-caption text-muted-foreground">We will turn your shop name into a link.</p>
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
          {shopPath(store.slug)} <ExternalLink aria-hidden className="inline size-3" />
        </a>
      </p>
    );
  } else if (slugCheck.status === 'checking') {
    slugHint = (
      <p className="text-caption text-muted-foreground">
        Checking <span className="font-mono">{shopPath(trimmedSlug)}</span>…
      </p>
    );
  } else if (slugCheck.status === 'available') {
    slugHint = (
      <p className="text-caption font-medium text-primary">
        <Check aria-hidden className="inline size-3.5" /> {shopPath(trimmedSlug)} is yours
      </p>
    );
  } else if (slugCheck.status === 'taken') {
    slugHint = (
      <p className="flex flex-wrap items-center gap-x-1.5 text-caption text-destructive">
        {shopPath(trimmedSlug)} is taken.
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
        Your page lives at <span className="font-mono">{shopPath(trimmedSlug)}</span>
      </p>
    );
  }

  const stepTitle =
    step === 0
      ? 'What should we call your shop?'
      : step === 1
        ? 'Where should orders land?'
        : step === 2
          ? 'Pick a look. We will make the logo.'
          : step === 3
            ? 'Where else can they find you?'
            : 'You are open for business.';

  const stepDescription =
    step === 0
      ? 'One name, one link. Tap a quick pick if you want to skip the typing.'
      : step === 1
        ? 'Customers tap Order and land in your WhatsApp. This is the number they will use.'
        : step === 2
          ? 'No designer needed. Tap a style and we will build your logo and shop banner from it.'
          : step === 3
            ? 'Optional. Add the networks you already use, or skip and add them later.'
            : store?.items.length
              ? 'Your shop is live and ready for its next order.'
              : 'Your shop is live. The last step is putting something on the shelf.';

  const primaryLabel =
    step === 0
      ? 'Next: WhatsApp'
      : step === 1
        ? 'Save & continue'
        : step === 2
          ? 'Use this look'
          : step === 3
            ? 'Save socials'
            : store?.items.length
              ? 'Back to my shop'
              : 'Add my first item';

  if (loading) {
    return (
      <div className="relative min-h-dvh overflow-hidden bg-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 12% 0%, #fff3e8 0, transparent 40%), radial-gradient(circle at 88% 8%, #ffe0bd 0, transparent 36%)',
          }}
        />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
          <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="hidden h-[460px] animate-pulse rounded-[1.6rem] bg-muted lg:block" />
            <div className="h-[420px] animate-pulse rounded-[1.75rem] bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <style>{`
        @keyframes onboarding-confetti {
          0% { opacity: 0; transform: translate3d(0, -24px, 0) rotate(0deg); }
          8% { opacity: 1; }
          100% { opacity: 0; transform: translate3d(34px, 560px, 0) rotate(620deg); }
        }
        .onboarding-confetti {
          animation-name: onboarding-confetti;
          animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
          animation-fill-mode: forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .onboarding-confetti { animation: none !important; opacity: 0 !important; }
        }
      `}</style>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 8% 0%, #fff3e8 0, transparent 38%), radial-gradient(circle at 92% 6%, #ffe0bd 0, transparent 34%), linear-gradient(180deg, #fffaf5 0%, #f5f5f5 46%, #f5f5f5 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-40 size-72 rounded-full border-[38px] border-highlight/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-20 size-64 rounded-full bg-primary/5 blur-2xl"
      />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center">
          <TilzaLogo className="text-2xl text-primary" />
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-card px-3 py-1.5 text-caption font-bold text-muted-foreground shadow-xs sm:inline-flex">
            Shop setup
          </span>
          {store && (
            <Button asChild variant="ghost" size="sm" className="h-9 font-semibold">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          )}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="size-9 rounded-full object-cover ring-2 ring-card"
            />
          ) : (
            <span className="grid size-9 place-items-center rounded-full bg-highlight font-display text-small font-extrabold text-highlight-foreground">
              {(firstName || 'T').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </header>

      <div className="relative mx-auto grid w-full max-w-6xl gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-start lg:gap-8">
        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <ShopPreview
            name={name}
            tagline={tagline}
            slug={slug}
            phone={phone}
            lookKey={lookKey}
            logoSrc={currentLogoUrl}
            bannerSrc={currentBannerUrl}
            socialCount={activeSocialCount}
          />
          <div className="mt-4 rounded-2xl border border-border bg-card/80 p-4">
            <p className="text-caption font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Your setup
            </p>
            <ul className="mt-3 grid gap-2">
              {STEPS.map((entry, index) => {
                const Icon = entry.icon;
                const done = index < step;
                const active = index === step;
                return (
                  <li key={entry.label} className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'grid size-7 place-items-center rounded-full',
                        done
                          ? 'bg-primary text-primary-foreground'
                          : active
                            ? 'bg-highlight-wash text-highlight-ink ring-2 ring-primary/25'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {done ? (
                        <Check aria-hidden className="size-3.5" />
                      ) : (
                        <Icon aria-hidden className="size-3.5" />
                      )}
                    </span>
                    <span
                      className={cn(
                        'text-small',
                        active ? 'font-bold text-foreground' : 'font-medium text-muted-foreground',
                      )}
                    >
                      {entry.label}
                    </span>
                    {active && (
                      <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-caption font-bold text-highlight-ink">
                        Now
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <section className="min-w-0">
          <ShopPreviewChip
            className="mb-4 lg:hidden"
            name={name}
            slug={slug}
            lookKey={lookKey}
            logoSrc={currentLogoUrl}
          />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (step < 4) void next();
              else finish();
            }}
            className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card p-5 shadow-xl sm:p-8"
          >
            {step === 4 && <Confetti />}
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-caption font-bold uppercase tracking-[0.08em] text-highlight-ink">
                  Step {Math.min(step + 1, STEPS.length)} of {STEPS.length}
                </p>
                <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-caption font-bold text-muted-foreground">
                  {(() => {
                    const Icon = STEPS[step]?.icon ?? Sparkles;
                    return <Icon aria-hidden className="size-3.5" />;
                  })()}
                  {STEPS[step]?.label}
                </p>
              </div>
              <div className="mt-3">
                <StepProgress step={step} />
              </div>

              <div
                key={step}
                className="mt-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
              >
                <h1
                  id="onboarding-title"
                  className="font-display text-h2 tracking-tight sm:text-h1"
                >
                  {stepTitle}
                </h1>
                <p className="mt-2 max-w-[48ch] text-small text-muted-foreground sm:text-body">
                  {stepDescription}
                </p>

                {step === 0 && (
                  <div className="mt-6 grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="ob-name" className="text-small font-bold">
                        Shop name
                      </Label>
                      <Input
                        id="ob-name"
                        value={name}
                        onChange={(event) => handleNameChange(event.target.value)}
                        autoComplete="organization"
                        placeholder="Ama's Boutique"
                        aria-invalid={!!fieldErrors.name}
                        aria-describedby={fieldErrors.name ? 'ob-name-error' : undefined}
                        className="h-14 rounded-2xl border-2 px-4 text-body-lg font-semibold"
                      />
                      {fieldErrors.name && (
                        <p id="ob-name-error" className="text-caption text-destructive">
                          {fieldErrors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-caption font-semibold text-muted-foreground">
                        Tap a quick pick if you want a head start.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {nameIdeas.map((idea) => (
                          <button
                            key={idea}
                            type="button"
                            onClick={() => applyNameIdea(idea)}
                            className={cn(
                              'rounded-full border px-3 py-1.5 text-small font-semibold transition-colors',
                              name === idea
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-highlight-wash',
                            )}
                          >
                            {idea}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-muted/40 p-3.5">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card text-primary shadow-xs">
                          <AtSign aria-hidden className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-caption font-bold text-muted-foreground">Your link</p>
                          <p className="truncate font-mono text-small font-semibold">
                            {shopPath(trimmedSlug)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowLink((value) => !value)}
                          className="h-8 shrink-0 font-semibold"
                        >
                          <Pencil aria-hidden className="size-3.5" />
                          {showLink ? 'Done' : 'Edit'}
                        </Button>
                      </div>
                      {showLink && (
                        <div className="mt-3 grid gap-2 border-t border-border pt-3">
                          <Label htmlFor="ob-slug" className="text-small font-bold">
                            Link word
                          </Label>
                          <Input
                            id="ob-slug"
                            value={slug}
                            onChange={(event) => handleSlugChange(event.target.value)}
                            placeholder="amas-boutique"
                            aria-invalid={!!fieldErrors.slug}
                            aria-describedby="ob-slug-hint"
                            className="h-11 rounded-xl font-mono"
                          />
                        </div>
                      )}
                      <div id="ob-slug-hint" className="mt-2" aria-live="polite">
                        {slugHint}
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-border">
                      <button
                        type="button"
                        onClick={() => setShowTagline((value) => !value)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        aria-expanded={showTagline}
                      >
                        <span>
                          <span className="text-small font-bold">Add a tagline</span>{' '}
                          <span className="text-caption text-muted-foreground">optional</span>
                        </span>
                        {showTagline ? (
                          <ChevronUp aria-hidden className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
                        )}
                      </button>
                      {showTagline && (
                        <div className="grid gap-2 border-t border-border p-4">
                          <Input
                            id="ob-tagline"
                            value={tagline}
                            onChange={(event) => setTagline(event.target.value)}
                            placeholder="Printed gear, made in Accra"
                            className="h-11 rounded-xl"
                          />
                          <div className="flex flex-wrap gap-2">
                            {TAGLINE_IDEAS.map((idea) => (
                              <button
                                key={idea}
                                type="button"
                                onClick={() => setTagline(idea)}
                                className="rounded-full bg-muted px-3 py-1.5 text-caption font-semibold text-muted-foreground transition-colors hover:bg-highlight-wash hover:text-highlight-ink"
                              >
                                {idea}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="mt-6 grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="ob-phone" className="text-small font-bold">
                        WhatsApp number
                      </Label>
                      <Input
                        id="ob-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(event) => {
                          setPhone(event.target.value);
                          clearFieldError('phone');
                        }}
                        placeholder="024 000 0000"
                        aria-invalid={!!fieldErrors.phone}
                        aria-describedby={fieldErrors.phone ? 'ob-phone-error' : 'ob-phone-hint'}
                        className="h-14 rounded-2xl border-2 px-4 text-body-lg font-semibold tracking-wide"
                      />
                      {fieldErrors.phone ? (
                        <p id="ob-phone-error" className="text-caption text-destructive">
                          {fieldErrors.phone}
                        </p>
                      ) : (
                        <p id="ob-phone-hint" className="text-caption text-muted-foreground">
                          Every order button opens a chat with this number.
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl bg-[#e7ffdb] p-4">
                      <div className="flex items-center gap-2 text-caption font-bold text-[#1f6b34]">
                        <MessageCircle aria-hidden className="size-4" />
                        Your WhatsApp inbox
                      </div>
                      <div className="mt-3 grid gap-2">
                        <p className="ml-auto max-w-[82%] rounded-2xl rounded-br-sm bg-[#d9fdd3] px-3.5 py-2 text-small text-[#111b15] shadow-xs">
                          Hi {name.trim() || 'your shop'}! I want to order.
                        </p>
                        <p className="max-w-[82%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2 text-small text-[#111b15] shadow-xs">
                          Send it through — I will pack it today.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="mt-6 grid gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      {SHOP_LOOKS.map((look) => {
                        const selected = visualMode === 'auto' && lookKey === look.key;
                        return (
                          <button
                            key={look.key}
                            type="button"
                            onClick={() => chooseLook(look.key)}
                            aria-pressed={selected}
                            className={cn(
                              'group overflow-hidden rounded-2xl border-2 p-2.5 text-left transition-colors',
                              selected
                                ? 'border-primary ring-2 ring-primary/20'
                                : 'border-border hover:border-primary/40',
                            )}
                          >
                            <span
                              className="relative block aspect-[16/9] overflow-hidden rounded-xl"
                              style={{
                                background: `linear-gradient(135deg, ${look.from}, ${look.to})`,
                              }}
                            >
                              <span
                                aria-hidden
                                className="absolute -right-4 -top-6 size-20 rounded-full border-[10px] border-white/20"
                              />
                              <span
                                className="absolute bottom-2 left-3 font-display text-4xl font-extrabold"
                                style={{ color: look.ink }}
                              >
                                {displayInitial}
                              </span>
                              {selected && (
                                <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-white text-primary shadow-sm">
                                  <Check aria-hidden className="size-3.5" />
                                </span>
                              )}
                            </span>
                            <span className="mt-2 flex items-center justify-between gap-2">
                              <span className="text-small font-bold">{look.label}</span>
                              <span
                                className="size-3 rounded-full"
                                style={{ backgroundColor: look.from }}
                              />
                            </span>
                            <span className="mt-0.5 block text-caption text-muted-foreground">
                              {look.blurb}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <p className="rounded-2xl bg-highlight-wash px-3.5 py-2.5 text-caption font-medium text-highlight-ink">
                      <Wand2 aria-hidden className="mr-1.5 inline size-3.5" />
                      We will generate a logo and a wide banner from your shop name.
                    </p>

                    {visualMode === 'keep' && (store?.hasLogo || store?.hasBanner) && (
                      <p className="rounded-2xl bg-muted px-3.5 py-2.5 text-caption font-medium text-muted-foreground">
                        <BadgeCheck aria-hidden className="mr-1.5 inline size-3.5 text-primary" />
                        Your current images stay unless you tap a look.
                      </p>
                    )}

                    <div className="overflow-hidden rounded-2xl border border-border">
                      <button
                        type="button"
                        onClick={() => setShowCustomVisuals((value) => !value)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        aria-expanded={showCustomVisuals}
                      >
                        <span className="inline-flex items-center gap-2 text-small font-bold">
                          <ImagePlus aria-hidden className="size-4 text-primary" />
                          Use my own photos
                        </span>
                        {showCustomVisuals ? (
                          <ChevronUp aria-hidden className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
                        )}
                      </button>
                      {showCustomVisuals && (
                        <div className="grid gap-5 border-t border-border p-4">
                          <div className="grid gap-2">
                            <Label className="text-small font-bold">Store logo</Label>
                            <ImagePicker
                              currentUrl={
                                store?.hasLogo
                                  ? `/api/public/store/${store.slug}/logo?t=${Date.parse(store.updatedAt)}`
                                  : null
                              }
                              value={logo}
                              onChange={pickLogo}
                              fit="contain"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-small font-bold">Store banner</Label>
                            <ImagePicker
                              currentUrl={
                                store?.hasBanner
                                  ? `/api/public/store/${store.slug}/banner?t=${Date.parse(store.updatedAt)}`
                                  : null
                              }
                              value={banner}
                              onChange={pickBanner}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-small font-bold">
                              Profile photo{' '}
                              <span className="font-normal text-muted-foreground">optional</span>
                            </Label>
                            <ImagePicker
                              currentUrl={avatarUrl}
                              value={avatar}
                              onChange={setAvatar}
                              shape="circle"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="mt-6 grid gap-4">
                    <div className="grid grid-cols-2 gap-2.5">
                      {SOCIAL_PLATFORM_DEFS.map((entry) => {
                        const Icon = SOCIAL_ICONS[entry.value];
                        const active = activeSocials.has(entry.value);
                        const handle =
                          socials.find((row) => row.platform === entry.value)?.handle ?? '';
                        return (
                          <button
                            key={entry.value}
                            type="button"
                            onClick={() => toggleSocial(entry.value)}
                            aria-pressed={active}
                            className={cn(
                              'flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-colors',
                              active
                                ? 'border-primary bg-highlight-wash/60'
                                : 'border-border bg-card hover:border-primary/40',
                            )}
                          >
                            <span
                              className={cn(
                                'grid size-9 shrink-0 place-items-center rounded-xl',
                                active
                                  ? SOCIAL_TINTS[entry.value]
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              <Icon aria-hidden className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-small font-bold">
                                {entry.label}
                              </span>
                              <span className="block truncate text-caption text-muted-foreground">
                                {active ? handle.trim() || 'Add handle' : 'Tap to add'}
                              </span>
                            </span>
                            <span
                              className={cn(
                                'grid size-6 shrink-0 place-items-center rounded-full',
                                active
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {active ? (
                                <Check aria-hidden className="size-3.5" />
                              ) : (
                                <Plus aria-hidden className="size-3.5" />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {activeSocials.size === 0 ? (
                      <p className="rounded-2xl bg-muted/60 px-4 py-3 text-small text-muted-foreground">
                        No socials? No problem. Your shop link and WhatsApp are enough to start.
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        {[...activeSocials].map((platform) => {
                          const definition = SOCIAL_PLATFORM_DEFS.find(
                            (entry) => entry.value === platform,
                          );
                          if (!definition) return null;
                          const Icon = SOCIAL_ICONS[platform];
                          return (
                            <div
                              key={platform}
                              className="grid gap-2 rounded-2xl border border-border p-4"
                            >
                              <Label
                                htmlFor={`ob-social-${platform}`}
                                className="flex items-center gap-2 text-small font-bold"
                              >
                                <Icon aria-hidden className="size-4 text-primary" />
                                {definition.label} handle
                              </Label>
                              <Input
                                id={`ob-social-${platform}`}
                                value={
                                  socials.find((row) => row.platform === platform)?.handle ?? ''
                                }
                                onChange={(event) =>
                                  setSocialField(platform, 'handle', event.target.value)
                                }
                                placeholder={
                                  platform === 'WHATSAPP_STATUS' ? '024 000 0000' : '@handle'
                                }
                                className="h-11 rounded-xl"
                              />
                              <p className="text-caption text-muted-foreground">
                                {definition.hint}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {step === 4 && store && (
                  <div className="mt-6 grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-3 rounded-2xl bg-highlight-wash p-4">
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-brand">
                        <BadgeCheck aria-hidden className="size-6" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-h4">Shop is live</p>
                        <p className="truncate font-mono text-caption text-muted-foreground">
                          {shopPath(store.slug)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void copyStoreLink()}
                        className="h-11 rounded-xl font-semibold"
                      >
                        <Copy aria-hidden className="size-4" /> Copy link
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={shareOnWhatsApp}
                        className="h-11 rounded-xl font-semibold"
                      >
                        <MessageCircle aria-hidden className="size-4" /> Share on WhatsApp
                      </Button>
                    </div>

                    <div className="rounded-2xl border border-border bg-muted/40 p-4">
                      <p className="text-small font-bold">What happens next?</p>
                      <ul className="mt-2 grid gap-2 text-small text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                          Add your first product so the shelf is not empty.
                        </li>
                        <li className="flex items-start gap-2">
                          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                          Share your link on WhatsApp, TikTok or Instagram.
                        </li>
                        <li className="flex items-start gap-2">
                          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                          Orders land in your WhatsApp and your dashboard.
                        </li>
                      </ul>
                    </div>

                    <Button asChild variant="outline" className="h-11 rounded-xl font-semibold">
                      <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer">
                        Preview my page <ExternalLink aria-hidden className="size-4" />
                      </a>
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => setStep((current) => Math.max(0, current - 1))}
                    className="h-11 w-full rounded-xl font-semibold sm:w-auto"
                  >
                    <ArrowLeft aria-hidden className="size-4" /> Back
                  </Button>
                ) : (
                  <span className="hidden sm:block" />
                )}
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  {step === 3 && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={saving}
                      onClick={skipSocials}
                      className="h-11 w-full rounded-xl font-semibold text-muted-foreground sm:w-auto"
                    >
                      Skip for now
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={saving}
                    className="h-11 w-full rounded-xl px-6 font-bold active:scale-[0.99] sm:w-auto"
                  >
                    {saving ? 'Saving…' : primaryLabel}{' '}
                    {step < 4 && <ArrowRight aria-hidden className="size-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </form>

          <p className="mt-4 text-center text-caption text-muted-foreground sm:text-left">
            Everything can be changed later in Settings or by reopening this page.
          </p>
        </section>
      </div>
    </div>
  );
}
