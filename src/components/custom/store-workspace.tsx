// Tilo store manager island: set up the shop's public page, then curate the
// product/service catalog. The share link is the /store/[slug] storefront.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  Calendar,
  Camera,
  Copy,
  ExternalLink,
  type LucideIcon,
  Megaphone,
  MessageCircle,
  Music2,
  Package,
  Pencil,
  Percent,
  Plus,
  Share2,
  Store as StoreIcon,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  emptyImageSelection,
  ImagePicker,
  type ImageSelection,
} from '@/components/custom/image-picker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { formatGhs } from '@/lib/contracts/order';
import {
  PromotionCreate,
  PromotionList,
  PromotionRecord,
  PromotionUpdate,
} from '@/lib/contracts/promotion';
import {
  type SocialPlatformValue,
  SocialPostList,
  SocialPostRecord,
  type SocialPostStatusValue,
} from '@/lib/contracts/social';
import {
  StoreItemCreate,
  StoreItemKind,
  type StoreItem as StoreItemRecord,
  StoreItemRecord as StoreItemSchema,
  StoreItemUpdate,
  StorePayload,
  type StorePayload as StoreRecord,
  StoreUpsert,
  type StoreUpsertInput,
} from '@/lib/contracts/store';
import { applyServerErrors } from '@/lib/forms';
import { compressImageFile } from '@/lib/image';
import { formatPromoDate, promoHeadline, promoTerms, promotionState } from '@/lib/promotions';
import {
  buildSocialCaption,
  SOCIAL_PLATFORM_DEFS,
  type SocialPlatformDef,
  shareUrlFor,
} from '@/lib/social';
import { uploadImageFile } from '@/lib/uploads';

function getErrorBody(error: unknown): unknown {
  return error instanceof Error ? error.cause : undefined;
}

function isNotFound(error: unknown) {
  return error instanceof Error && error.message.includes('(404)');
}

function cedisToPesewas(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function pesewasToCedis(pesewas: number): string {
  return (pesewas / 100).toString();
}

function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const kindLabels: Record<StoreItemRecord['kind'], string> = {
  PRODUCT: 'Product',
  SERVICE: 'Service',
};

const platformIcons: Record<SocialPlatformValue, LucideIcon> = {
  TIKTOK: Music2,
  INSTAGRAM: Camera,
  FACEBOOK_PAGE: Megaphone,
  WHATSAPP_STATUS: MessageCircle,
};

const statusStyles: Record<SocialPostStatusValue, string> = {
  SHARED: 'bg-amber-100 text-amber-800 dark:bg-stone-800 dark:text-amber-300',
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
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-amber-800 dark:bg-stone-800 dark:text-amber-300">
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
                className="flex items-center gap-3 rounded-2xl border-2 border-amber-950 bg-amber-50/50 px-4 py-3 text-left hover:bg-amber-100 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-400 text-white">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-display font-black uppercase tracking-tight">
                    {entry.label}
                  </span>
                  <span className="block text-xs font-medium text-stone-500">{entry.hint}</span>
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
              className="text-sm font-black uppercase tracking-wide text-stone-600 dark:text-stone-300"
            >
              Caption
            </label>
            <textarea
              id="publish-caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={6}
              className="w-full rounded-2xl border-2 border-amber-950 bg-white px-3 py-2 text-sm font-medium dark:border-stone-700 dark:bg-stone-900"
            />
            <p className="text-xs font-medium text-stone-500">
              We copy this and open {platformDef(platform).label} — posting stays hands-on. Tweak it
              here first.
            </p>
          </div>
          <Button
            type="button"
            disabled={busy || caption.trim().length === 0}
            onClick={() => void publish()}
            className="h-11 rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
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
      <div className="mt-4 rounded-[1.5rem] border-2 border-dashed border-amber-400 px-5 py-8 text-center">
        <p className="font-display font-black uppercase">Nothing pushed yet</p>
        <p className="mt-1 text-sm font-medium text-stone-500">
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
          <div
            key={post.id}
            className="rounded-[1.5rem] border-2 border-amber-950 bg-white p-4 dark:bg-stone-900"
          >
            <div className="flex flex-wrap items-center gap-2">
              <PlatformBadge value={post.platform} />
              <span className="min-w-0 truncate text-sm font-black">{post.itemName}</span>
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wider ${statusStyles[post.status]}`}
              >
                {post.status === 'PUBLISHED' ? 'Posted' : 'Shared'}
              </span>
              <span className="text-xs font-medium text-stone-400">
                {formatPostTime(post.createdAt)}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm font-medium text-stone-600 dark:text-stone-300">
              {post.caption}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {post.status === 'PUBLISHED' && post.externalUrl ? (
                <Button
                  asChild
                  variant="outline"
                  className="h-9 rounded-full text-xs font-black uppercase tracking-wide"
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
                    className="h-9 rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
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
                    className="h-9 rounded-full text-xs font-black uppercase tracking-wide"
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
                    className="h-9 rounded-full text-xs font-black uppercase tracking-wide"
                  >
                    <Icon aria-hidden className="size-3.5" /> Reopen
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMarkingUrl(post.id)}
                    className="h-9 rounded-full text-xs font-black uppercase tracking-wide"
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

function StoreForm({
  initial,
  onSaved,
}: {
  initial: StoreRecord | null;
  onSaved: (store: StoreRecord) => void;
}) {
  const form = useForm<z.input<typeof StoreUpsert>, unknown, StoreUpsertInput>({
    resolver: zodResolver(StoreUpsert),
    defaultValues: initial
      ? {
          name: initial.name,
          slug: initial.slug,
          tagline: initial.tagline ?? '',
          promoBanner: initial.promoBanner ?? '',
          description: initial.description ?? '',
          contactPhone: initial.contactPhone ?? '',
          active: initial.active,
        }
      : {
          name: '',
          slug: '',
          tagline: '',
          promoBanner: '',
          description: '',
          contactPhone: '',
          active: true,
        },
  });
  const [logo, setLogo] = useState<ImageSelection>(emptyImageSelection);
  const logoUrl = initial?.hasLogo ? `/api/public/store/${initial.slug}/logo` : null;

  async function onSubmit(values: StoreUpsertInput) {
    try {
      let saved = await apiFetch('/api/store', {
        method: 'PUT',
        body: JSON.stringify({
          ...values,
          tagline: cleanOptional(values.tagline),
          promoBanner: cleanOptional(values.promoBanner),
          description: cleanOptional(values.description),
          contactPhone: cleanOptional(values.contactPhone),
        }),
        schema: StorePayload,
      });
      if (logo.file) {
        const compressed = await compressImageFile(logo.file);
        saved = await uploadImageFile('/api/store/logo', compressed, logo.file.name, StorePayload);
      } else if (logo.cleared) {
        saved = await apiFetch('/api/store/logo', { method: 'DELETE', schema: StorePayload });
      }
      onSaved(saved);
      toast.success(initial ? 'Store saved' : 'Store is live!');
    } catch (error) {
      const applied = applyServerErrors(getErrorBody(error), form.setError);
      if (!applied) toast.error('Could not save the store');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Store name</FormLabel>
                <FormControl>
                  <Input placeholder="Ama's Boutique" {...field} className="rounded-2xl" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Link word</FormLabel>
                <FormControl>
                  <Input placeholder="amas-boutique" {...field} className="rounded-2xl" />
                </FormControl>
                <FormMessage />
                <p className="text-xs font-medium text-stone-500">
                  Your page lives at /store/<span className="font-mono">{field.value || '…'}</span>
                </p>
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="tagline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tagline</FormLabel>
              <FormControl>
                <Input
                  placeholder="Printed gear, made loud in Accra"
                  {...field}
                  className="rounded-2xl"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="promoBanner"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Announcement banner</FormLabel>
              <FormControl>
                <Input
                  placeholder="Mid-sem sale — quote STUDENT10 in your order!"
                  {...field}
                  className="rounded-2xl"
                />
              </FormControl>
              <FormMessage />
              <p className="text-xs font-medium text-stone-500">
                Shown as a headline at the top of your page. Leave blank to hide.
              </p>
            </FormItem>
          )}
        />
        <FormItem>
          <Label>Logo</Label>
          <div>
            <ImagePicker currentUrl={logoUrl} value={logo} onChange={setLogo} />
          </div>
          <p className="text-xs font-medium text-stone-500">
            A small logo for the header of your public page.
          </p>
        </FormItem>
        <FormField
          control={form.control}
          name="contactPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>WhatsApp number for orders</FormLabel>
              <FormControl>
                <Input placeholder="024 000 0000" {...field} className="rounded-2xl" />
              </FormControl>
              <FormMessage />
              <p className="text-xs font-medium text-stone-500">
                Every &quot;order&quot; button opens a chat with this number.
              </p>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>About the store</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="What do you make or do?"
                  {...field}
                  className="rounded-2xl"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-2xl border-2 border-amber-100 px-4 py-3 dark:border-stone-800">
              <div>
                <FormLabel className="!mt-0">Storefront open</FormLabel>
                <p className="text-xs font-medium text-stone-500">
                  Switch off to take the page down.
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Storefront open"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="h-12 w-full rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700 sm:w-auto"
        >
          {form.formState.isSubmitting ? 'Saving…' : initial ? 'Save store' : 'Set up store'}
        </Button>
      </form>
    </Form>
  );
}

function ItemForm({
  initial,
  onSaved,
  onClose,
}: {
  initial: StoreItemRecord | null;
  onSaved: (item: StoreItemRecord) => void;
  onClose: () => void;
}) {
  const [price, setPrice] = useState(initial ? pesewasToCedis(initial.pricePesewas) : '');
  const [compareAt, setCompareAt] = useState(
    initial?.compareAtPricePesewas != null ? pesewasToCedis(initial.compareAtPricePesewas) : '',
  );
  const [image, setImage] = useState<ImageSelection>(emptyImageSelection);
  const imageUrl = initial?.hasImage ? `/api/public/store/items/${initial.id}/image` : null;

  const schema = initial ? StoreItemUpdate : StoreItemCreate;
  type SchemaInput = z.input<typeof schema>;

  const form = useForm<SchemaInput, unknown>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          name: initial.name,
          kind: initial.kind,
          description: initial.description ?? '',
          active: initial.active,
        }
      : { name: '', kind: 'PRODUCT', description: '', active: true },
  });

  async function onSubmit(values: SchemaInput) {
    const amountPesewas = cedisToPesewas(price);
    if (amountPesewas == null) {
      toast.error('Enter a valid price in cedis (e.g. 45.50)');
      return;
    }
    const compareRaw = compareAt.trim();
    let compareAtPricePesewas: number | null = null;
    if (compareRaw) {
      const parsed = cedisToPesewas(compareRaw);
      if (parsed == null) {
        toast.error('Enter a valid original price in cedis or leave it blank');
        return;
      }
      compareAtPricePesewas = parsed;
    }
    const payload = {
      ...values,
      description: cleanOptional((values as { description?: string }).description),
      pricePesewas: amountPesewas,
      compareAtPricePesewas,
    };
    try {
      let saved = initial
        ? await apiFetch(`/api/store/items/${initial.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
            schema: StoreItemSchema,
          })
        : await apiFetch('/api/store/items', {
            method: 'POST',
            body: JSON.stringify(payload),
            schema: StoreItemSchema,
          });
      if (image.file) {
        const compressed = await compressImageFile(image.file);
        saved = await uploadImageFile(
          `/api/store/items/${saved.id}/image`,
          compressed,
          image.file.name || 'photo.jpg',
          StoreItemSchema,
        );
      } else if (image.cleared) {
        saved = await apiFetch(`/api/store/items/${saved.id}/image`, {
          method: 'DELETE',
          schema: StoreItemSchema,
        });
      }
      onSaved(saved);
      toast.success(initial ? 'Item updated' : 'Item added to the shelf');
    } catch (error) {
      const applied = applyServerErrors(getErrorBody(error), form.setError);
      if (!applied) toast.error('Could not save the item');
      return;
    }
    onClose();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Branded apron, one colour"
                    {...field}
                    className="rounded-2xl"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="kind"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What is it?</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {StoreItemKind.options.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {kindLabels[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormItem>
            <Label>Price (cedis)</Label>
            <div>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="45.50"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="rounded-2xl"
              />
            </div>
          </FormItem>
          <FormItem>
            <Label>Original price (cedis)</Label>
            <div>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="60.00"
                value={compareAt}
                onChange={(event) => setCompareAt(event.target.value)}
                className="rounded-2xl"
              />
            </div>
            <p className="text-xs font-medium text-stone-500">
              The &quot;was&quot; price — higher than the price and customers see a strikethrough
              with a % off badge. Leave blank to hide.
            </p>
          </FormItem>
        </div>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="What exactly do they get?"
                  {...field}
                  className="rounded-2xl"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem>
          <Label>Photo</Label>
          <div>
            <ImagePicker currentUrl={imageUrl} value={image} onChange={setImage} />
          </div>
          <p className="text-xs font-medium text-stone-500">
            Photos make the shelf pop — customers see them on your public page.
          </p>
        </FormItem>
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-2xl border-2 border-amber-100 px-4 py-3 dark:border-stone-800">
              <div>
                <FormLabel className="!mt-0">On the shelf</FormLabel>
                <p className="text-xs font-medium text-stone-500">
                  Hidden items stay listed here but leave the public page.
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="On the shelf"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-11 rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
          >
            {form.formState.isSubmitting ? 'Saving…' : initial ? 'Save item' : 'Add to shelf'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-11 rounded-full font-black uppercase tracking-wide"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

function PromoForm({
  initial,
  onSaved,
  onClose,
}: {
  initial: PromotionRecord | null;
  onSaved: (promo: PromotionRecord) => void;
  onClose: () => void;
}) {
  const [valueRaw, setValueRaw] = useState(
    initial
      ? initial.kind === 'PERCENT'
        ? String(initial.value)
        : pesewasToCedis(initial.value)
      : '',
  );
  const [minOrderRaw, setMinOrderRaw] = useState(
    initial?.minSubtotalPesewas != null ? pesewasToCedis(initial.minSubtotalPesewas) : '',
  );
  const [startsAt, setStartsAt] = useState(initial?.startsAt ? initial.startsAt.slice(0, 10) : '');
  const [endsAt, setEndsAt] = useState(initial?.endsAt ? initial.endsAt.slice(0, 10) : '');
  const [image, setImage] = useState<ImageSelection>(emptyImageSelection);
  const imageUrl = initial?.hasImage ? `/api/public/store/promotions/${initial.id}/image` : null;

  const schema = initial ? PromotionUpdate : PromotionCreate;
  type SchemaInput = z.input<typeof schema>;

  const form = useForm<SchemaInput, unknown>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          name: initial.name,
          code: initial.code ?? '',
          kind: initial.kind,
          active: initial.active,
        }
      : { name: '', code: '', kind: 'PERCENT', active: true },
  });

  const currentKind = (form.watch('kind') as 'PERCENT' | 'FIXED' | undefined) ?? 'PERCENT';

  async function onSubmit(values: SchemaInput) {
    const raw = valueRaw.trim();
    let value: number;
    if (currentKind === 'PERCENT') {
      const percent = Number.parseInt(raw, 10);
      if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
        toast.error('Enter the discount as a whole percentage between 1 and 100');
        return;
      }
      value = percent;
    } else {
      const pesewas = cedisToPesewas(raw);
      if (pesewas == null || pesewas <= 0) {
        toast.error('Enter a valid discount amount in cedis (e.g. 5)');
        return;
      }
      value = pesewas;
    }
    let minSubtotalPesewas: number | null = null;
    if (minOrderRaw.trim()) {
      const parsed = cedisToPesewas(minOrderRaw);
      if (parsed == null) {
        toast.error('Enter a valid minimum order in cedis or leave it blank');
        return;
      }
      minSubtotalPesewas = parsed;
    }
    const payload = {
      ...values,
      code: (values as { code?: string }).code?.trim() ?? '',
      value,
      minSubtotalPesewas,
      startsAt: startsAt.trim() || null,
      endsAt: endsAt.trim() || null,
    };
    try {
      let saved = initial
        ? await apiFetch(`/api/store/promotions/${initial.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
            schema: PromotionRecord,
          })
        : await apiFetch('/api/store/promotions', {
            method: 'POST',
            body: JSON.stringify(payload),
            schema: PromotionRecord,
          });
      if (image.file) {
        const compressed = await compressImageFile(image.file);
        saved = await uploadImageFile(
          `/api/store/promotions/${saved.id}/image`,
          compressed,
          image.file.name || 'banner.jpg',
          PromotionRecord,
        );
      } else if (image.cleared) {
        saved = await apiFetch(`/api/store/promotions/${saved.id}/image`, {
          method: 'DELETE',
          schema: PromotionRecord,
        });
      }
      onSaved(saved);
      toast.success(initial ? 'Promo updated' : 'Promo created — it shows on your page now');
    } catch (error) {
      const applied = applyServerErrors(getErrorBody(error), form.setError);
      if (!applied) toast.error('Could not save the promo');
      return;
    }
    onClose();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Promo name</FormLabel>
                <FormControl>
                  <Input placeholder="Mid-sem sale" {...field} className="rounded-2xl" />
                </FormControl>
                <FormMessage />
                <p className="text-xs font-medium text-stone-500">
                  What customers see on the offer card.
                </p>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount code (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="STUDENT10"
                    name={field.name}
                    value={(field.value as string) ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className="rounded-2xl uppercase"
                  />
                </FormControl>
                <FormMessage />
                <p className="text-xs font-medium text-stone-500">
                  Customers quote it in their order. Blank = no code needed.
                </p>
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="kind"
            render={({ field }) => (
              <FormItem>
                <FormLabel>How much off?</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="PERCENT">Percentage off</SelectItem>
                    <SelectItem value="FIXED">Fixed amount (cedis)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormItem>
            <Label>{currentKind === 'PERCENT' ? 'Discount (percent)' : 'Discount (cedis)'}</Label>
            <div>
              <Input
                type="text"
                inputMode="decimal"
                placeholder={currentKind === 'PERCENT' ? '10' : '5'}
                value={valueRaw}
                onChange={(event) => setValueRaw(event.target.value)}
                className="rounded-2xl"
              />
            </div>
          </FormItem>
        </div>
        <FormItem>
          <Label>Minimum order to qualify (cedis, optional)</Label>
          <div>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="50"
              value={minOrderRaw}
              onChange={(event) => setMinOrderRaw(event.target.value)}
              className="rounded-2xl"
            />
          </div>
          <p className="text-xs font-medium text-stone-500">
            Leave blank to let every order use the discount.
          </p>
        </FormItem>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormItem>
            <Label>Starts</Label>
            <div>
              <Input
                type="date"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className="rounded-2xl"
              />
            </div>
          </FormItem>
          <FormItem>
            <Label>Ends</Label>
            <div>
              <Input
                type="date"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                className="rounded-2xl"
              />
            </div>
          </FormItem>
        </div>
        <FormItem>
          <Label>Banner image (optional)</Label>
          <div>
            <ImagePicker currentUrl={imageUrl} value={image} onChange={setImage} />
          </div>
          <p className="text-xs font-medium text-stone-500">
            A wide banner makes the offer pop on your public page.
          </p>
        </FormItem>
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-2xl border-2 border-amber-100 px-4 py-3 dark:border-stone-800">
              <div>
                <FormLabel className="!mt-0">Promo live</FormLabel>
                <p className="text-xs font-medium text-stone-500">
                  Switch off anytime to pull it from your page.
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Promo live"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-11 rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
          >
            {form.formState.isSubmitting ? 'Saving…' : initial ? 'Save promo' : 'Create promo'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-11 rounded-full font-black uppercase tracking-wide"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function StoreWorkspace() {
  const [store, setStore] = useState<StoreRecord | null>(null);
  const [posts, setPosts] = useState<SocialPostRecord[] | null>(null);
  const [promotions, setPromotions] = useState<PromotionRecord[] | null>(null);
  const [publishItem, setPublishItem] = useState<StoreItemRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [itemDialog, setItemDialog] = useState<{ open: boolean; editing: StoreItemRecord | null }>({
    open: false,
    editing: null,
  });
  const [promoDialog, setPromoDialog] = useState<{
    open: boolean;
    editing: PromotionRecord | null;
  }>({ open: false, editing: null });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/store', { schema: StorePayload })
      .then((result) => {
        if (!cancelled) setStore(result);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        if (isNotFound(requestError)) setStore(null);
        else setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/store/posts', { schema: SocialPostList })
      .then((result) => {
        if (!cancelled) setPosts(result.items);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/store/promotions', { schema: PromotionList })
      .then((result) => {
        if (!cancelled) setPromotions(result.items);
      })
      .catch(() => {
        if (!cancelled) setPromotions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const storefrontUrl = store
    ? typeof window !== 'undefined'
      ? `${window.location.origin}/store/${store.slug}`
      : `/store/${store.slug}`
    : null;

  async function copyLink() {
    if (!storefrontUrl) return;
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed — select the link and copy it yourself');
    }
  }

  async function deleteItem(item: StoreItemRecord) {
    try {
      await apiFetch(`/api/store/items/${item.id}`, { method: 'DELETE' });
      setStore((current) =>
        current ? { ...current, items: current.items.filter((i) => i.id !== item.id) } : current,
      );
      setPosts((current) =>
        current ? current.filter((post) => post.itemId !== item.id) : current,
      );
      toast.success('Item removed');
    } catch {
      toast.error('Could not remove the item');
    }
  }

  function savePromo(promo: PromotionRecord) {
    setPromotions((current) =>
      current == null
        ? current
        : promoDialog.editing
          ? current.map((entry) => (entry.id === promo.id ? promo : entry))
          : [promo, ...current],
    );
  }

  async function togglePromo(promo: PromotionRecord) {
    try {
      const updated = await apiFetch(`/api/store/promotions/${promo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !promo.active }),
        schema: PromotionRecord,
      });
      setPromotions(
        (current) => current?.map((entry) => (entry.id === promo.id ? updated : entry)) ?? current,
      );
      toast.success(updated.active ? 'Promo is live' : 'Promo paused');
    } catch {
      toast.error('Could not update the promo');
    }
  }

  async function deletePromo(promo: PromotionRecord) {
    try {
      await apiFetch(`/api/store/promotions/${promo.id}`, { method: 'DELETE' });
      setPromotions((current) => current?.filter((entry) => entry.id !== promo.id) ?? current);
      toast.success('Promo removed');
    } catch {
      toast.error('Could not remove the promo');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center font-display text-sm font-black uppercase tracking-[0.25em] text-amber-500">
        Opening the shop…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border-2 border-amber-950 bg-white p-8 text-center dark:bg-stone-900">
        <p className="font-display text-2xl font-black uppercase">Shutters stuck</p>
        <p className="mt-2 text-sm font-medium text-stone-500">
          The store would not load. Try again.
        </p>
        <Button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-amber-950 p-7 text-amber-50 sm:p-9">
        <StoreIcon
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 size-40 rotate-12 text-amber-900"
        />
        <p className="relative text-xs font-black uppercase tracking-[0.25em] text-amber-300">
          The storefront
        </p>
        <div className="relative mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-black uppercase leading-none sm:text-5xl">
              {store ? store.name : 'Your shop window'}
            </h1>
            <p className="mt-2 max-w-lg text-sm font-medium text-amber-200">
              {store
                ? 'Customers see this page — browse it, then order items straight to your WhatsApp.'
                : 'Give yourself a public page: name it, add your items and prices, share the link.'}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <section className="rounded-[2rem] border-2 border-amber-950 bg-white p-6 dark:bg-stone-900 sm:p-7">
          <h2 className="flex items-center gap-2 font-display text-xl font-black uppercase">
            <StoreIcon aria-hidden className="size-5 text-amber-600" /> Store details
          </h2>
          <div className="mt-4">
            <StoreForm key={store?.id ?? 'new'} initial={store} onSaved={setStore} />
          </div>
        </section>

        <div className="grid content-start gap-6">
          {store ? (
            <section className="rotate-1 rounded-[2rem] bg-amber-950 p-6 text-amber-50 sm:p-7">
              <h2 className="flex items-center gap-2 font-display text-lg font-black uppercase text-amber-300">
                <ExternalLink aria-hidden className="size-5" /> Share this page
              </h2>
              {storefrontUrl && (
                <p className="mt-3 break-all rounded-2xl bg-amber-50/10 px-3 py-2 font-mono text-xs font-bold text-amber-100">
                  {storefrontUrl}
                </p>
              )}
              <p className="mt-2 text-xs font-medium text-amber-200">
                Put it in your bio, on flyers, anywhere customers look.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void copyLink()}
                  className="h-10 rounded-full bg-amber-300 font-black uppercase tracking-wide text-amber-950 hover:bg-amber-200"
                >
                  <Copy aria-hidden className="size-4" /> {copied ? 'Copied!' : 'Copy link'}
                </Button>
                {storefrontUrl && (
                  <Button
                    asChild
                    variant="outline"
                    className="h-10 rounded-full border-amber-50/40 font-black uppercase tracking-wide text-amber-100 hover:bg-amber-50/10"
                  >
                    <a href={storefrontUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink aria-hidden className="size-4" /> Preview
                    </a>
                  </Button>
                )}
              </div>
            </section>
          ) : (
            <section className="rotate-1 rounded-[2rem] border-2 border-dashed border-amber-400 bg-white p-6 dark:bg-stone-900">
              <p className="font-display text-lg font-black uppercase">Not live yet</p>
              <p className="mt-1 text-sm font-medium text-stone-500">
                Save the store details first — you&apos;ll get a shareable link here.
              </p>
            </section>
          )}
        </div>
      </div>

      {store && (
        <section className="rounded-[2rem] border-2 border-amber-950 bg-white p-6 dark:bg-stone-900 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-black uppercase">The shelf</h2>
              <p className="mt-1 text-sm font-medium text-stone-500">
                Everything people can order — products and services together.
              </p>
            </div>
            <Button
              type="button"
              className="h-11 rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
              onClick={() => setItemDialog({ open: true, editing: null })}
            >
              <Plus aria-hidden className="size-4" /> Add item
            </Button>
          </div>

          {store.items.length === 0 ? (
            <div className="mt-5 rounded-[1.5rem] border-2 border-dashed border-amber-400 px-5 py-10 text-center">
              <p className="font-display font-black uppercase">Empty shelf</p>
              <p className="mt-1 text-sm font-medium text-stone-500">
                Add your first product or service — it appears on the public page right away.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {store.items.map((item, i) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-4 rounded-[1.5rem] border-2 border-amber-950 bg-white p-4 shadow-[4px_4px_0_0_#451a03] dark:bg-stone-900 ${
                    i % 2 === 1 ? 'rotate-[0.5deg]' : '-rotate-[0.5deg]'
                  }`}
                >
                  {item.hasImage ? (
                    <span className="size-12 shrink-0 overflow-hidden rounded-2xl">
                      <img
                        src={`/api/public/store/items/${item.id}/image`}
                        alt=""
                        className="size-full object-cover"
                      />
                    </span>
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-400 text-white">
                      {item.kind === 'SERVICE' ? (
                        <Wrench aria-hidden className="size-5" />
                      ) : (
                        <Package aria-hidden className="size-5" />
                      )}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-display font-black uppercase tracking-tight">
                        {item.name}
                      </span>
                      {!item.active && (
                        <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wider text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                          Hidden
                        </span>
                      )}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-stone-500">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-black uppercase tracking-wider text-amber-800 dark:bg-stone-800 dark:text-amber-300">
                        {kindLabels[item.kind]}
                      </span>
                      <span className="font-mono text-sm font-black text-amber-950 dark:text-amber-50">
                        {formatGhs(item.pricePesewas)}
                      </span>
                    </p>
                    {item.description && (
                      <p className="mt-1 truncate text-xs font-medium text-stone-500">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Push ${item.name} to socials`}
                      onClick={() => setPublishItem(item)}
                      className="size-9 rounded-full"
                    >
                      <Share2 aria-hidden className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => setItemDialog({ open: true, editing: item })}
                      className="size-9 rounded-full"
                    >
                      <Pencil aria-hidden className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => void deleteItem(item)}
                      className="size-9 rounded-full text-red-600 hover:text-red-700"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {store && (
        <section className="rounded-[2rem] border-2 border-amber-950 bg-white p-6 dark:bg-stone-900 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-black uppercase">Sales &amp; promos</h2>
              <p className="mt-1 text-sm font-medium text-stone-500">
                Discounts and codes — customers see them as &quot;Today&apos;s offers&quot; on your
                page.
              </p>
            </div>
            <Button
              type="button"
              className="h-11 rounded-full bg-yellow-600 font-black uppercase tracking-wide text-white hover:bg-amber-700"
              onClick={() => setPromoDialog({ open: true, editing: null })}
            >
              <Plus aria-hidden className="size-4" /> New promo
            </Button>
          </div>

          {promotions === null ? (
            <div className="mt-4 rounded-[1.5rem] border-2 border-dashed border-amber-400 px-5 py-8 text-center">
              <p className="font-display font-black uppercase">Loading promos…</p>
            </div>
          ) : promotions.length === 0 ? (
            <div className="mt-5 rounded-[1.5rem] border-2 border-dashed border-amber-400 px-5 py-10 text-center">
              <p className="font-display font-black uppercase">No promos yet</p>
              <p className="mt-1 text-sm font-medium text-stone-500">
                Add a sale or a discount code and your page becomes a deal customers share.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {promotions.map((promo) => {
                const state = promotionState(promo);
                const pill =
                  state === 'live'
                    ? {
                        label: 'Live now',
                        className:
                          'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                      }
                    : state === 'upcoming'
                      ? {
                          label: 'Scheduled',
                          className:
                            'bg-amber-100 text-amber-800 dark:bg-stone-800 dark:text-amber-300',
                        }
                      : state === 'ended'
                        ? {
                            label: 'Ended',
                            className:
                              'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
                          }
                        : {
                            label: 'Paused',
                            className:
                              'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
                          };
                const terms = promoTerms(promo);
                const windowLabel = promo.startsAt
                  ? promo.endsAt
                    ? `${formatPromoDate(promo.startsAt)} – ${formatPromoDate(promo.endsAt)}`
                    : `From ${formatPromoDate(promo.startsAt)}`
                  : promo.endsAt
                    ? `Until ${formatPromoDate(promo.endsAt)}`
                    : null;
                return (
                  <div
                    key={promo.id}
                    className={`flex items-center gap-4 rounded-[1.5rem] border-2 border-amber-950 bg-white p-4 shadow-[4px_4px_0_0_#451a03] dark:bg-stone-900 ${
                      state !== 'live' ? 'opacity-75' : ''
                    }`}
                  >
                    {promo.hasImage ? (
                      <span className="size-12 shrink-0 overflow-hidden rounded-2xl">
                        <img
                          src={`/api/public/store/promotions/${promo.id}/image`}
                          alt=""
                          className="size-full object-cover"
                        />
                      </span>
                    ) : (
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-400 text-white">
                        <Percent aria-hidden className="size-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-display font-black uppercase tracking-tight">
                          {promo.name}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wider ${pill.className}`}
                        >
                          {pill.label}
                        </span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-stone-500">
                        <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-300">
                          {promoHeadline(promo)}
                        </span>
                        {promo.code ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-black uppercase tracking-wider text-amber-800 dark:bg-stone-800 dark:text-amber-300">
                            CODE {promo.code}
                          </span>
                        ) : (
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 font-black uppercase tracking-wider text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                            No code needed
                          </span>
                        )}
                        {terms.map((term) => (
                          <span key={term}>{term}</span>
                        ))}
                      </p>
                      {windowLabel && (
                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-stone-400">
                          <Calendar aria-hidden className="size-3" /> {windowLabel}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Switch
                        checked={promo.active}
                        onCheckedChange={() => void togglePromo(promo)}
                        aria-label={`Turn ${promo.name} on or off`}
                      />
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${promo.name}`}
                          onClick={() => setPromoDialog({ open: true, editing: promo })}
                          className="size-8 rounded-full"
                        >
                          <Pencil aria-hidden className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${promo.name}`}
                          onClick={() => void deletePromo(promo)}
                          className="size-8 rounded-full text-red-600 hover:text-red-700"
                        >
                          <Trash2 aria-hidden className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {store && (
        <section className="rounded-[2rem] border-2 border-amber-950 bg-white p-6 dark:bg-stone-900 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-black uppercase">Publishing log</h2>
              <p className="mt-1 text-sm font-medium text-stone-500">
                Every push goes here — mark it posted once it&apos;s live.
              </p>
            </div>
            <Share2 aria-hidden className="size-5 text-amber-600" />
          </div>
          {posts === null ? (
            <div className="mt-4 rounded-[1.5rem] border-2 border-dashed border-amber-400 px-5 py-8 text-center">
              <p className="font-display font-black uppercase">Loading the log…</p>
            </div>
          ) : (
            <PublishLog
              posts={posts}
              onMarked={(post) =>
                setPosts(
                  (current) =>
                    current?.map((entry) => (entry.id === post.id ? post : entry)) ?? current,
                )
              }
              onRemoved={(postId) =>
                setPosts((current) => current?.filter((entry) => entry.id !== postId) ?? current)
              }
            />
          )}
        </section>
      )}

      <Dialog
        open={itemDialog.open}
        onOpenChange={(open) => setItemDialog({ open, editing: null })}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[1.75rem] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display font-black uppercase">
              {itemDialog.editing ? 'Fix the item' : 'Something new on the shelf'}
            </DialogTitle>
            <DialogDescription>
              {itemDialog.editing
                ? 'Update the name, price or description.'
                : 'Products and services both appear on your public page.'}
            </DialogDescription>
          </DialogHeader>
          <ItemForm
            key={itemDialog.editing?.id ?? 'new'}
            initial={itemDialog.editing}
            onSaved={(item) => {
              setStore((current) =>
                current
                  ? {
                      ...current,
                      items: itemDialog.editing
                        ? current.items.map((existing) =>
                            existing.id === item.id ? item : existing,
                          )
                        : [...current.items, item],
                    }
                  : current,
              );
            }}
            onClose={() => setItemDialog({ open: false, editing: null })}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={promoDialog.open}
        onOpenChange={(open) => setPromoDialog({ open, editing: null })}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[1.75rem] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display font-black uppercase">
              {promoDialog.editing ? 'Fix the promo' : 'New promo'}
            </DialogTitle>
            <DialogDescription>
              {promoDialog.editing
                ? 'Tweak the offer — changes show on your page immediately.'
                : 'A sale or discount code. Customers see it as a Today&apos;s offer.'}
            </DialogDescription>
          </DialogHeader>
          <PromoForm
            key={promoDialog.editing?.id ?? 'new'}
            initial={promoDialog.editing}
            onSaved={savePromo}
            onClose={() => setPromoDialog({ open: false, editing: null })}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={publishItem !== null}
        onOpenChange={(open) => {
          if (!open) setPublishItem(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[1.75rem] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display font-black uppercase">
              Push &quot;{publishItem?.name}&quot; out there
            </DialogTitle>
            <DialogDescription>
              Pick a place — we copy the caption and open that app so you finish the post.
            </DialogDescription>
          </DialogHeader>
          {publishItem && store && (
            <PublishDialog
              item={publishItem}
              store={store}
              onLogged={(post) => setPosts((current) => (current ? [post, ...current] : current))}
              onClose={() => setPublishItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
