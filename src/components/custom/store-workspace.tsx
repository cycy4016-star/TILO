// Tilo store manager island: set up the shop's public page, then curate the
// product/service catalog. The share link is the /store/[slug] storefront.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Calendar,
  Copy,
  ExternalLink,
  FolderPlus,
  Package,
  Pencil,
  Percent,
  Plus,
  Share2,
  Store as StoreIcon,
  Trash2,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { CategoryWizard } from '@/components/custom/category-wizard';
import {
  emptyImageSelection,
  ImagePicker,
  type ImageSelection,
} from '@/components/custom/image-picker';
import { ItemWizard } from '@/components/custom/item-wizard';
import { PromoWizard } from '@/components/custom/promo-wizard';
import { ShareSheet } from '@/components/custom/share-sheet';
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
import { CATEGORY_ICONS } from '@/lib/category-icons';
import {
  CategoryCreate,
  type CategoryRecord,
  CategoryRecord as CategorySchema,
  CategoryUpdate,
} from '@/lib/contracts/category';
import { formatGhs } from '@/lib/contracts/order';
import {
  PromotionCreate,
  PromotionList,
  PromotionRecord,
  PromotionUpdate,
} from '@/lib/contracts/promotion';
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
import { fitImageFile, SLOT_HINT } from '@/lib/image';
import { formatPromoDate, promoHeadline, promoTerms, promotionState } from '@/lib/promotions';
import { productShareMessage } from '@/lib/share';
import {
  APPEARANCE_PRESETS,
  normalizeAppearance,
  normalizeTheme,
  THEME_PRESETS,
} from '@/lib/theme';
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

// Radix Select will not accept "" as an <SelectItem value>, so "no shelf" is
// spelled out here and converted back to null when the payload is built.
const NO_CATEGORY = '__none__';

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
          theme: normalizeTheme(initial.theme),
          appearance: normalizeAppearance(initial.appearance),
        }
      : {
          name: '',
          slug: '',
          tagline: '',
          promoBanner: '',
          description: '',
          contactPhone: '',
          active: true,
          theme: 'ember',
          appearance: 'professional',
        },
  });
  const [logo, setLogo] = useState<ImageSelection>(emptyImageSelection);
  const logoUrl = initial?.hasLogo
    ? `/api/public/store/${initial.slug}/logo?t=${Date.parse(initial.updatedAt)}`
    : null;
  const [banner, setBanner] = useState<ImageSelection>(emptyImageSelection);
  const bannerUrl = initial?.hasBanner
    ? `/api/public/store/${initial.slug}/banner?t=${Date.parse(initial.updatedAt)}`
    : null;

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
        const compressed = await fitImageFile(logo.file, 'logo');
        saved = await uploadImageFile('/api/store/logo', compressed, logo.file.name, StorePayload);
      } else if (logo.cleared) {
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
      } else if (banner.cleared) {
        saved = await apiFetch('/api/store/banner', { method: 'DELETE', schema: StorePayload });
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
                  <Input placeholder="Ama's Boutique" {...field} className="rounded-md" />
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
                  <Input placeholder="amas-boutique" {...field} className="rounded-md" />
                </FormControl>
                <FormMessage />
                <p className="text-xs text-muted-foreground">
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
                  placeholder="e.g. Printed gear, made in Accra"
                  {...field}
                  className="rounded-md"
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
                  className="rounded-md"
                />
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground">
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
          <p className="text-xs text-muted-foreground">
            A small logo for the header of your public page. {SLOT_HINT.logo}
          </p>
        </FormItem>
        <FormItem>
          <Label>Banner</Label>
          <div>
            <ImagePicker currentUrl={bannerUrl} value={banner} onChange={setBanner} />
          </div>
          <p className="text-xs text-muted-foreground">
            A wide banner across the top of your public page. {SLOT_HINT.banner}
          </p>
        </FormItem>
        <FormField
          control={form.control}
          name="contactPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>WhatsApp number for orders</FormLabel>
              <FormControl>
                <Input placeholder="024 000 0000" {...field} className="rounded-md" />
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground">
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
                  className="rounded-md"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="theme"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shop colour</FormLabel>
              <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <legend className="sr-only">Shop colour</legend>
                {THEME_PRESETS.map((preset) => {
                  const selected = field.value === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => field.onChange(preset.key)}
                      className={`flex items-center gap-2 rounded-md border border-border px-2.5 py-2 text-left transition-colors ${
                        selected
                          ? 'bg-primary/5 ring-2 ring-ring ring-offset-2 ring-offset-background'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <span
                        aria-hidden
                        className="size-6 shrink-0 rounded-md border border-border"
                        style={{ backgroundColor: preset.accents[0] }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-caption font-medium">
                          {preset.label}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </fieldset>
              <p className="text-xs text-muted-foreground">
                Recolours your public page instantly. Same catalogue, your brand.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="appearance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Page style</FormLabel>
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="sr-only">Page style</legend>
                {APPEARANCE_PRESETS.map((preset) => {
                  const selected = field.value === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => field.onChange(preset.key)}
                      className={`rounded-md border border-border px-3 py-2.5 text-left transition-colors ${
                        selected
                          ? 'bg-primary/5 ring-2 ring-ring ring-offset-2 ring-offset-background'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <span className="block text-caption font-medium">{preset.label}</span>
                      <span className="block text-caption text-muted-foreground">
                        {preset.tagline}
                      </span>
                    </button>
                  );
                })}
              </fieldset>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
              <div>
                <FormLabel className="!mt-0">Storefront open</FormLabel>
                <p className="text-xs text-muted-foreground">Switch off to take the page down.</p>
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
          className="h-11 w-full rounded-md font-semibold sm:w-auto"
        >
          {form.formState.isSubmitting ? 'Saving…' : initial ? 'Save store' : 'Set up store'}
        </Button>
      </form>
    </Form>
  );
}

// Shelf-heading editor. A category is just a name plus an on/off switch, so
// this stays a one-field dialog rather than the full ItemForm machinery.
function CategoryForm({
  initial,
  onSaved,
  onClose,
}: {
  initial: CategoryRecord | null;
  onSaved: (category: CategoryRecord) => void;
  onClose: () => void;
}) {
  const schema = initial ? CategoryUpdate : CategoryCreate;
  type SchemaInput = z.input<typeof schema>;

  const form = useForm<SchemaInput, unknown>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? { name: initial.name, active: initial.active, sortOrder: initial.sortOrder }
      : { name: '', active: true },
  });
  const [icon, setIcon] = useState<string | null>(initial?.icon ?? null);
  const [cover, setCover] = useState<ImageSelection>(emptyImageSelection);
  const coverUrl =
    initial?.hasCover && !cover.cleared
      ? `/api/public/store/categories/${initial.id}/image?t=${Date.parse(initial.updatedAt)}`
      : null;

  async function onSubmit(values: SchemaInput) {
    try {
      const saved = initial
        ? await apiFetch(`/api/store/categories/${initial.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ ...values, icon }),
            schema: CategorySchema,
          })
        : await apiFetch('/api/store/categories', {
            method: 'POST',
            body: JSON.stringify({ ...values, icon }),
            schema: CategorySchema,
          });
      let current = saved;
      if (cover.file) {
        const compressed = await fitImageFile(cover.file, 'cover');
        current = await uploadImageFile(
          `/api/store/categories/${saved.id}/cover`,
          compressed,
          cover.file.name,
          CategorySchema,
        );
      } else if (cover.cleared && saved.hasCover) {
        current = await apiFetch(`/api/store/categories/${saved.id}/cover`, {
          method: 'DELETE',
          schema: CategorySchema,
        });
      }
      onSaved(current);
      toast.success(initial ? 'Category updated' : 'Category added');
    } catch (error) {
      const applied = applyServerErrors(getErrorBody(error), form.setError);
      if (!applied) toast.error('Could not save the category');
      return;
    }
    onClose();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Beads, Wall art, Custom orders…"
                  {...field}
                  className="rounded-md"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-2">
          <span id="category-icon-label" className="text-sm font-medium" aria-hidden>
            Icon <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <fieldset
            className="grid grid-cols-4 gap-1.5 sm:grid-cols-7"
            aria-labelledby="category-icon-label"
          >
            <legend className="sr-only">Shelf icon</legend>
            {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
              <Button
                key={key}
                type="button"
                variant={icon === key ? 'default' : 'outline'}
                aria-pressed={icon === key}
                aria-label={`${key} icon`}
                onClick={() => setIcon((current) => (current === key ? null : current))}
                className="size-10 rounded-md p-0"
              >
                <Icon aria-hidden className="size-4" />
              </Button>
            ))}
          </fieldset>
        </div>
        <FormItem>
          <Label>Cover photo</Label>
          <div>
            <ImagePicker currentUrl={coverUrl} value={cover} onChange={setCover} />
          </div>
          <p className="text-xs text-muted-foreground">Shown on the shelf card, when set.</p>
        </FormItem>
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
              <div>
                <FormLabel className="!mt-0">Show on the public page</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Hiding a shelf also hides every product on it.
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Show on the public page"
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
            className="h-11 rounded-md font-semibold"
          >
            {form.formState.isSubmitting ? 'Saving…' : initial ? 'Save category' : 'Add category'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-11 rounded-md font-semibold"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

function ItemForm({
  initial,
  categories,
  onSaved,
  onClose,
}: {
  initial: StoreItemRecord | null;
  categories: CategoryRecord[];
  onSaved: (item: StoreItemRecord) => void;
  onClose: () => void;
}) {
  const [price, setPrice] = useState(initial ? pesewasToCedis(initial.pricePesewas) : '');
  const [cost, setCost] = useState(
    initial?.costPricePesewas != null ? pesewasToCedis(initial.costPricePesewas) : '',
  );
  const [compareAt, setCompareAt] = useState(
    initial?.compareAtPricePesewas != null ? pesewasToCedis(initial.compareAtPricePesewas) : '',
  );
  const [stock, setStock] = useState(initial?.stock != null ? String(initial.stock) : '');
  const [image, setImage] = useState<ImageSelection>(emptyImageSelection);
  // Held outside react-hook-form like the price fields: the shelf is optional
  // and Radix Select refuses "" as an item value, so it needs a sentinel.
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? NO_CATEGORY);
  const imageUrl = initial?.hasImage
    ? `/api/public/store/items/${initial.id}/image?t=${Date.parse(initial.updatedAt)}`
    : null;

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
    const costRaw = cost.trim();
    let costPricePesewas: number | null = null;
    if (costRaw) {
      const parsed = cedisToPesewas(costRaw);
      if (parsed == null) {
        toast.error('Enter a valid cost in cedis or leave it blank');
        return;
      }
      costPricePesewas = parsed;
    }
    const stockRaw = stock.trim();
    let stockCount: number | null = null;
    if (stockRaw) {
      if (!/^\d+$/.test(stockRaw)) {
        toast.error('Enter whole units on hand, or leave blank for untracked');
        return;
      }
      stockCount = Number.parseInt(stockRaw, 10);
    }
    const payload = {
      ...values,
      description: cleanOptional((values as { description?: string }).description),
      categoryId: categoryId === NO_CATEGORY ? null : categoryId,
      pricePesewas: amountPesewas,
      compareAtPricePesewas,
      costPricePesewas,
      stock: stockCount,
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
        const compressed = await fitImageFile(image.file, 'item');
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
      toast.success(initial ? 'Item updated' : 'Item added to catalogue');
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
                    className="rounded-md"
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
                    <SelectTrigger className="rounded-md">
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
        <FormItem>
          <Label>Category</Label>
          <div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="rounded-md" aria-label="Category">
                <SelectValue placeholder="Choose a shelf" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                    {!category.active ? ' (hidden)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Group products so shoppers can browse by shelf —
            {categories.length === 0 ? ' create one first.' : ' customers see these as sections.'}
          </p>
        </FormItem>
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
                className="rounded-md"
              />
            </div>
          </FormItem>
          <FormItem>
            <Label>Cost price (cedis)</Label>
            <div>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="28.00"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                className="rounded-md"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              What you pay for the item — used for profit and Intelligence analytics. Leave blank to
              hide.
            </p>
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
                className="rounded-md"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The &quot;was&quot; price — higher than the price and customers see a strikethrough
              with a % off badge. Leave blank to hide.
            </p>
          </FormItem>
          <FormItem>
            <Label>Stock on hand</Label>
            <div>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="20"
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                className="rounded-md"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Whole units. Blank means untracked; 0 hides the order button.
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
                  className="rounded-md"
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
          <p className="text-xs text-muted-foreground">
            Photos help customers see what you offer — they appear on your public page.
          </p>
        </FormItem>
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
              <div>
                <FormLabel className="!mt-0">Available</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Hidden items stay listed here but leave the public page.
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Available"
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
            className="h-11 rounded-md font-semibold"
          >
            {form.formState.isSubmitting ? 'Saving…' : initial ? 'Save item' : 'Add item'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-11 rounded-md font-semibold"
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
  items = [],
  categories = [],
}: {
  initial: PromotionRecord | null;
  onSaved: (promo: PromotionRecord) => void;
  onClose: () => void;
  items?: { id: string; name: string }[];
  categories?: { id: string; name: string }[];
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
  const [itemIds, setItemIds] = useState<string[]>(initial?.itemIds ?? []);
  const [categoryIds, setCategoryIds] = useState<string[]>(initial?.categoryIds ?? []);
  const [image, setImage] = useState<ImageSelection>(emptyImageSelection);
  const imageUrl = initial?.hasImage
    ? `/api/public/store/promotions/${initial.id}/image?t=${Date.parse(initial.updatedAt)}`
    : null;

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
      itemIds,
      categoryIds,
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
        const compressed = await fitImageFile(image.file, 'promo');
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
                  <Input placeholder="Mid-sem sale" {...field} className="rounded-md" />
                </FormControl>
                <FormMessage />
                <p className="text-xs text-muted-foreground">
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
                    className="rounded-md uppercase"
                  />
                </FormControl>
                <FormMessage />
                <p className="text-xs text-muted-foreground">
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
                    <SelectTrigger className="rounded-md">
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
                className="rounded-md"
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
              className="rounded-md"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Leave blank to let every order use the discount.
          </p>
        </FormItem>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">
            Applies to{' '}
            <span className="font-normal text-muted-foreground">(empty = whole store)</span>
          </legend>
          <div className="grid max-h-44 gap-1 overflow-y-auto rounded-md border border-border p-2">
            {categories.map((category) => (
              <label
                key={category.id}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={categoryIds.includes(category.id)}
                  onChange={() =>
                    setCategoryIds((current) =>
                      current.includes(category.id)
                        ? current.filter((id) => id !== category.id)
                        : [...current, category.id],
                    )
                  }
                  className="size-4 accent-primary"
                />
                <span className="text-small">Shelf: {category.name}</span>
              </label>
            ))}
            {items.map((item) => (
              <label
                key={item.id}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={itemIds.includes(item.id)}
                  onChange={() =>
                    setItemIds((current) =>
                      current.includes(item.id)
                        ? current.filter((id) => id !== item.id)
                        : [...current, item.id],
                    )
                  }
                  className="size-4 accent-primary"
                />
                <span className="text-small">{item.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormItem>
            <Label>Starts</Label>
            <div>
              <Input
                type="date"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className="rounded-md"
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
                className="rounded-md"
              />
            </div>
          </FormItem>
        </div>
        <FormItem>
          <Label>Banner image (optional)</Label>
          <div>
            <ImagePicker currentUrl={imageUrl} value={image} onChange={setImage} />
          </div>
          <p className="text-xs text-muted-foreground">
            A wide banner makes the offer stand out on your public page.
          </p>
        </FormItem>
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
              <div>
                <FormLabel className="!mt-0">Promo live</FormLabel>
                <p className="text-xs text-muted-foreground">
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
            className="h-11 rounded-md font-semibold"
          >
            {form.formState.isSubmitting ? 'Saving…' : initial ? 'Save promo' : 'Create promo'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-11 rounded-md font-semibold"
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
  const [promotions, setPromotions] = useState<PromotionRecord[] | null>(null);
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
  const [itemWizardOpen, setItemWizardOpen] = useState(false);
  const [categoryWizardOpen, setCategoryWizardOpen] = useState(false);
  const [promoWizardOpen, setPromoWizardOpen] = useState(false);
  const [shareItem, setShareItem] = useState<StoreItemRecord | null>(null);
  const [categoryDialog, setCategoryDialog] = useState<{
    open: boolean;
    editing: CategoryRecord | null;
  }>({ open: false, editing: null });
  const [copied, setCopied] = useState(false);

  async function refreshStore() {
    try {
      setStore(await apiFetch('/api/store', { schema: StorePayload }));
      setPromotions((await apiFetch('/api/store/promotions', { schema: PromotionList })).items);
    } catch {
      toast.error('Could not refresh the catalogue');
    }
  }

  // The catalogue renders grouped by shelf, so bucket the flat item list once
  // per store change rather than re-scanning it inside the JSX.
  const catalogueGroups = useMemo(() => {
    const ordered = [...(store?.categories ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    const buckets = ordered.map((category) => ({ category, items: [] as StoreItemRecord[] }));
    const loose: StoreItemRecord[] = [];
    for (const item of store?.items ?? []) {
      const bucket = buckets.find((entry) => entry.category.id === item.categoryId);
      if (bucket) bucket.items.push(item);
      else loose.push(item);
    }
    return { buckets, loose };
  }, [store]);

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
      toast.success('Item removed');
    } catch {
      toast.error('Could not remove the item');
    }
  }

  async function toggleCategory(category: CategoryRecord) {
    try {
      const updated = await apiFetch(`/api/store/categories/${category.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !category.active }),
        schema: CategorySchema,
      });
      saveCategory(updated);
      toast.success(updated.active ? 'Category is live' : 'Category hidden');
    } catch {
      toast.error('Could not update the category');
    }
  }

  function saveCategory(category: CategoryRecord) {
    setStore((current) => {
      if (!current) return current;
      const exists = current.categories.some((entry) => entry.id === category.id);
      return {
        ...current,
        categories: exists
          ? current.categories.map((entry) => (entry.id === category.id ? category : entry))
          : [...current.categories, category],
      };
    });
  }

  async function deleteCategory(category: CategoryRecord) {
    try {
      await apiFetch(`/api/store/categories/${category.id}`, { method: 'DELETE' });
      // The API refuses a delete while products are on the shelf, so by here the
      // heading is empty — but belt and braces: any stray reference falls back
      // to "Uncategorised" instead of vanishing.
      setStore((current) =>
        current
          ? {
              ...current,
              categories: current.categories.filter((entry) => entry.id !== category.id),
              items: current.items.map((item) =>
                item.categoryId === category.id ? { ...item, categoryId: null } : item,
              ),
            }
          : current,
      );
      toast.success('Category removed');
    } catch (error) {
      // A non-empty delete answers 409 with the exact count to move.
      const body = getErrorBody(error) as { error?: string } | undefined;
      toast.error(typeof body?.error === 'string' ? body.error : 'Could not remove the category');
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
      <div className="flex min-h-64 items-center justify-center text-caption font-medium text-muted-foreground">
        Loading your store…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-h4 font-display">Store unavailable</p>
        <p className="mt-2 text-sm text-muted-foreground">
          We could not load your store. Please try again.
        </p>
        <Button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 font-semibold"
        >
          Try again
        </Button>
      </div>
    );
  }

  // One product/service row. Extracted because the grouped catalogue renders it
  // once per shelf plus a final uncategorised bucket.
  function renderItem(item: StoreItemRecord) {
    return (
      <div
        key={item.id}
        className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
      >
        {item.hasImage ? (
          <span className="size-12 shrink-0 overflow-hidden rounded-lg">
            <img
              src={`/api/public/store/items/${item.id}/image?t=${Date.parse(item.updatedAt)}`}
              alt=""
              className="size-full object-cover"
            />
          </span>
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {item.kind === 'SERVICE' ? (
              <Wrench aria-hidden className="size-5" />
            ) : (
              <Package aria-hidden className="size-5" />
            )}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold">{item.name}</span>
            {!item.active && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground">
                Hidden
              </span>
            )}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary">
              {kindLabels[item.kind]}
            </span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {formatGhs(item.pricePesewas)}
            </span>
            {item.stock != null && (
              <span
                className={`rounded-full px-2 py-0.5 text-caption font-medium ${
                  item.stock === 0
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {item.stock === 0 ? 'Sold out' : `${item.stock} left`}
              </span>
            )}
          </p>
          {item.description && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{item.description}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Share ${item.name}`}
            onClick={() => setShareItem(item)}
            className="size-9 rounded-md"
          >
            <Share2 aria-hidden className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Edit ${item.name}`}
            onClick={() => setItemDialog({ open: true, editing: item })}
            className="size-9 rounded-md"
          >
            <Pencil aria-hidden className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${item.name}`}
            onClick={() => void deleteItem(item)}
            className="size-9 rounded-md text-destructive"
          >
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <p className="text-eyebrow">The storefront</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-h2 font-display">{store ? store.name : 'Your shop window'}</h1>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              {store
                ? 'Customers see this page — browse it, then order items straight to your WhatsApp.'
                : 'Give yourself a public page: name it, add your items and prices, share the link.'}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <section
          id="store-details"
          className="scroll-mt-24 rounded-xl border border-border bg-card p-6 sm:p-7"
        >
          <h2 className="flex items-center gap-2 text-h3 font-display">
            <StoreIcon aria-hidden className="size-5 text-primary" /> Store details
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Name, socials, logo and banner live in{' '}
            <Link href="/welcome" className="font-semibold text-primary hover:underline">
              store setup
            </Link>
            .
          </p>
          <div className="mt-4">
            <StoreForm key={store?.id ?? 'new'} initial={store} onSaved={setStore} />
          </div>
        </section>

        <div className="grid content-start gap-6">
          {store ? (
            <section className="rounded-xl border border-border bg-muted/40 p-6">
              <h2 className="flex items-center gap-2 text-h4 font-display">
                <ExternalLink aria-hidden className="size-5 text-primary" /> Share this page
              </h2>
              {storefrontUrl && (
                <p className="mt-3 break-all rounded-lg bg-card px-3 py-2 font-mono text-xs text-muted-foreground">
                  {storefrontUrl}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Put it in your bio, on flyers, anywhere customers look.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void copyLink()}
                  className="h-9 rounded-md font-semibold"
                >
                  <Copy aria-hidden className="size-4" /> {copied ? 'Copied!' : 'Copy link'}
                </Button>
                {storefrontUrl && (
                  <Button asChild variant="outline" className="h-9 rounded-md font-semibold">
                    <a href={storefrontUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink aria-hidden className="size-4" /> Preview
                    </a>
                  </Button>
                )}
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-border bg-muted/40 p-6 text-small text-muted-foreground">
              <p className="text-h4 font-display text-foreground">Not live yet</p>
              <p className="mt-1">
                Save the store details first — you&apos;ll get a shareable link here.
              </p>
            </section>
          )}
        </div>
      </div>

      {store && (
        <section id="categories" className="rounded-xl border border-border bg-card p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-h3 font-display">Categories</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The shelves your products sit on — shoppers browse your page by these.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 font-semibold"
              onClick={() => setCategoryWizardOpen(true)}
            >
              <FolderPlus aria-hidden className="size-4" /> New category
            </Button>
          </div>

          {store.categories.length === 0 ? (
            <div className="mt-5 rounded-xl border border-border bg-muted/40 p-6 text-center text-small text-muted-foreground">
              <p className="text-h4 font-display text-foreground">No categories yet</p>
              <p className="mt-1">
                Optional — but shelves are what keep a long catalogue browsable.
              </p>
            </div>
          ) : (
            <ul className="mt-5 grid gap-2">
              {store.categories.map((category) => (
                <li
                  key={category.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{category.name}</span>
                      {!category.active && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground">
                          Hidden
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {category.itemCount} {category.itemCount === 1 ? 'product' : 'products'}
                    </p>
                  </div>
                  <Switch
                    checked={category.active}
                    onCheckedChange={() => void toggleCategory(category)}
                    aria-label={`Show ${category.name} on the public page`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${category.name}`}
                    onClick={() => setCategoryDialog({ open: true, editing: category })}
                    className="size-9 rounded-md"
                  >
                    <Pencil aria-hidden className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${category.name}`}
                    onClick={() => void deleteCategory(category)}
                    className="size-9 rounded-md text-destructive"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {store && (
        <section id="the-shelf" className="rounded-xl border border-border bg-card p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-h3 font-display">Catalogue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Everything people can order — products and services together.
              </p>
            </div>
            <Button
              type="button"
              className="h-11 font-semibold"
              onClick={() => setItemWizardOpen(true)}
            >
              <Plus aria-hidden className="size-4" /> Add item
            </Button>
          </div>

          {store.items.length === 0 ? (
            <div className="mt-5 rounded-xl border border-border bg-muted/40 p-6 text-center text-small text-muted-foreground">
              <p className="text-h4 font-display text-foreground">Empty catalogue</p>
              <p className="mt-1">
                Add your first product or service — it appears on the public page right away.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {catalogueGroups.buckets
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.category.id}>
                    <p className="mb-2 flex flex-wrap items-center gap-2 text-caption font-medium text-muted-foreground">
                      <FolderPlus aria-hidden className="size-3.5 text-primary" />
                      <span>{group.category.name}</span>
                      {!group.category.active && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground">
                          Hidden from the public page
                        </span>
                      )}
                      <span className="font-mono normal-case">
                        {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                      </span>
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {group.items.map((item) => renderItem(item))}
                    </div>
                  </div>
                ))}
              {catalogueGroups.loose.length > 0 && (
                <div>
                  <p className="mb-2 flex flex-wrap items-center gap-2 text-caption font-medium text-muted-foreground">
                    <FolderPlus aria-hidden className="size-3.5" />
                    <span>Uncategorised</span>
                    <span className="font-mono normal-case">
                      {catalogueGroups.loose.length}{' '}
                      {catalogueGroups.loose.length === 1 ? 'item' : 'items'}
                    </span>
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {catalogueGroups.loose.map((item) => renderItem(item))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {store && (
        <section
          id="sales-and-promos"
          className="rounded-xl border border-border bg-card p-6 sm:p-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-h3 font-display">Sales &amp; promos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Discounts and codes — customers see them as &quot;Today&apos;s offers&quot; on your
                page.
              </p>
            </div>
            <Button
              type="button"
              className="h-11 font-semibold"
              onClick={() => setPromoWizardOpen(true)}
            >
              <Plus aria-hidden className="size-4" /> New promo
            </Button>
          </div>

          {promotions === null ? (
            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-6 text-center text-small text-muted-foreground">
              <p className="font-medium text-foreground">Loading promos…</p>
            </div>
          ) : promotions.length === 0 ? (
            <div className="mt-5 rounded-xl border border-border bg-muted/40 p-6 text-center text-small text-muted-foreground">
              <p className="text-h4 font-display text-foreground">No promos yet</p>
              <p className="mt-1">
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
                        className: 'bg-primary/10 text-primary',
                      }
                    : state === 'upcoming'
                      ? {
                          label: 'Scheduled',
                          className: 'bg-muted text-foreground',
                        }
                      : state === 'ended'
                        ? {
                            label: 'Ended',
                            className: 'bg-muted text-muted-foreground',
                          }
                        : {
                            label: 'Paused',
                            className: 'bg-muted text-foreground',
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
                    className={`flex items-center gap-4 rounded-xl border border-border bg-card p-4 ${
                      state !== 'live' ? 'opacity-75' : ''
                    }`}
                  >
                    {promo.hasImage ? (
                      <span className="size-12 shrink-0 overflow-hidden rounded-lg">
                        <img
                          src={`/api/public/store/promotions/${promo.id}/image?t=${Date.parse(promo.updatedAt)}`}
                          alt=""
                          className="size-full object-cover"
                        />
                      </span>
                    ) : (
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Percent aria-hidden className="size-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold">{promo.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-caption font-medium ${pill.className}`}
                        >
                          {pill.label}
                        </span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {promoHeadline(promo)}
                        </span>
                        {promo.code ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary">
                            CODE {promo.code}
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground">
                            No code needed
                          </span>
                        )}
                        {terms.map((term) => (
                          <span key={term}>{term}</span>
                        ))}
                      </p>
                      {windowLabel && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
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
                          className="size-8 rounded-md"
                        >
                          <Pencil aria-hidden className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${promo.name}`}
                          onClick={() => void deletePromo(promo)}
                          className="size-8 rounded-md text-destructive"
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

      <ItemWizard
        open={itemWizardOpen}
        onOpenChange={setItemWizardOpen}
        categories={store?.categories ?? []}
        onSaved={() => void refreshStore()}
      />

      <CategoryWizard
        open={categoryWizardOpen}
        onOpenChange={setCategoryWizardOpen}
        onSaved={() => void refreshStore()}
      />

      <PromoWizard
        open={promoWizardOpen}
        onOpenChange={setPromoWizardOpen}
        onSaved={() => void refreshStore()}
        items={(store?.items ?? []).map((item) => ({ id: item.id, name: item.name }))}
        categories={(store?.categories ?? []).map((category) => ({
          id: category.id,
          name: category.name,
        }))}
      />

      {shareItem && storefrontUrl && store && (
        <ShareSheet
          open={shareItem !== null}
          onOpenChange={(next) => {
            if (!next) setShareItem(null);
          }}
          title={`Share “${shareItem.name}”`}
          description="Send this product anywhere — WhatsApp carries the price and link."
          message={productShareMessage({
            storeName: store.name,
            itemName: shareItem.name,
            priceLabel: formatGhs(shareItem.pricePesewas),
            itemUrl: `${storefrontUrl}#${shareItem.id}`,
          })}
          url={`${storefrontUrl}#${shareItem.id}`}
          imageUrl={`/api/public/store/items/${shareItem.id}/share`}
          imageName={`${shareItem.name}-share.png`}
        />
      )}

      <Dialog
        open={itemDialog.open}
        onOpenChange={(open) => setItemDialog({ open, editing: null })}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-h3">Edit the item</DialogTitle>
            <DialogDescription>Update the name, price or description.</DialogDescription>
          </DialogHeader>
          <ItemForm
            key={itemDialog.editing?.id ?? 'new'}
            initial={itemDialog.editing}
            categories={store?.categories ?? []}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-h3">Edit the promo</DialogTitle>
            <DialogDescription>
              Tweak the offer — changes show on your page immediately.
            </DialogDescription>
          </DialogHeader>
          <PromoForm
            key={promoDialog.editing?.id ?? 'new'}
            initial={promoDialog.editing}
            onSaved={savePromo}
            onClose={() => setPromoDialog({ open: false, editing: null })}
            items={(store?.items ?? []).map((item) => ({ id: item.id, name: item.name }))}
            categories={(store?.categories ?? []).map((category) => ({
              id: category.id,
              name: category.name,
            }))}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={categoryDialog.open}
        onOpenChange={(open) => setCategoryDialog({ open, editing: null })}
      >
        <DialogContent className="rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-h3">Edit the category</DialogTitle>
            <DialogDescription>Rename the shelf or hide it from the public page.</DialogDescription>
          </DialogHeader>
          <CategoryForm
            key={categoryDialog.editing?.id ?? 'new'}
            initial={categoryDialog.editing}
            onSaved={saveCategory}
            onClose={() => setCategoryDialog({ open: false, editing: null })}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
