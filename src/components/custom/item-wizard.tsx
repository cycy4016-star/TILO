// Guided product creation: one question at a time, completed steps collapsing
// into summary chips while the next question slides in. Create-only; edits
// keep the existing ItemForm dialog.
'use client';

import { ArrowLeft, ArrowRight, Check, ImagePlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { CropDialog } from '@/components/custom/crop-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { type CategoryRecord, CategoryRecord as CategorySchema } from '@/lib/contracts/category';
import { formatGhs } from '@/lib/contracts/order';
import {
  type PromotionRecord,
  PromotionRecord as PromotionSchema,
} from '@/lib/contracts/promotion';
import {
  type StoreItem as StoreItemRecord,
  StoreItemRecord as StoreItemSchema,
} from '@/lib/contracts/store';
import { fitImageFile, makeBlurPlaceholder, validateImageFile } from '@/lib/image';
import { uploadImageFile } from '@/lib/uploads';

const NEW_CATEGORY = '__new__';

export type WizardState = {
  name: string;
  kind: 'PRODUCT' | 'SERVICE';
  photo: File | null;
  photoPreview: string | null;
  photoBlur: string | null;
  categoryId: string | null;
  newCategoryName: string;
  newCategoryIcon: string | null;
  price: string;
  compareAt: string;
  cost: string;
  description: string;
  stockTracked: boolean;
  stock: string;
  promoOn: boolean;
  promoValue: string;
  promoEnds: string;
};

export const WIZARD_STEPS = [
  'Name',
  'Photo',
  'Shelf',
  'Price',
  'Details',
  'Stock',
  'Promo',
  'Review',
] as const;

function parseCedis(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Per-step gate: null means the step is answerable enough to continue. */
export function validateWizardStep(step: number, state: WizardState): string | null {
  switch (step) {
    case 0:
      return state.name.trim() ? null : 'Give the product a name';
    case 1:
      return null;
    case 2:
      if (state.categoryId === NEW_CATEGORY && !state.newCategoryName.trim()) {
        return 'Name the new shelf, or pick an existing one';
      }
      return null;
    case 3: {
      const price = parseCedis(state.price);
      if (price == null || price <= 0) return 'Enter a valid price in cedis (e.g. 45.50)';
      if (state.compareAt.trim()) {
        const was = parseCedis(state.compareAt);
        if (was == null) return 'Enter a valid original price, or leave it blank';
        if (was <= price) return 'Original price must beat the sale price';
      }
      if (state.cost.trim() && parseCedis(state.cost) == null) {
        return 'Enter a valid cost in cedis, or leave it blank';
      }
      return null;
    }
    case 4:
      return null;
    case 5:
      if (!state.stockTracked) return null;
      if (!/^\d+$/.test(state.stock.trim())) return 'Enter whole units on hand, or untrack stock';
      return null;
    case 6:
      if (!state.promoOn) return null;
      if (!/^\d+$/.test(state.promoValue.trim())) return 'Enter a whole percent between 1 and 100';
      {
        const value = Number.parseInt(state.promoValue, 10);
        if (value < 1 || value > 100) return 'Enter a whole percent between 1 and 100';
      }
      return null;
    default:
      return validateWizardStep(0, state) ?? validateWizardStep(3, state);
  }
}

function discountPct(pricePesewas: number, compareAtPesewas: number | null): number | null {
  if (compareAtPesewas == null || compareAtPesewas <= pricePesewas) return null;
  return Math.round((1 - pricePesewas / compareAtPesewas) * 100);
}

export function ItemWizard({
  open,
  onOpenChange,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryRecord[];
  onSaved: () => void;
}) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({
    name: '',
    kind: 'PRODUCT',
    photo: null,
    photoPreview: null,
    photoBlur: null,
    categoryId: null,
    newCategoryName: '',
    newCategoryIcon: null,
    price: '',
    compareAt: '',
    cost: '',
    description: '',
    stockTracked: false,
    stock: '',
    promoOn: false,
    promoValue: '',
    promoEnds: '',
  });
  const [cropOpen, setCropOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  function set(patch: Partial<WizardState>) {
    setState((current) => ({ ...current, ...patch }));
  }

  function reset() {
    if (state.photoPreview) URL.revokeObjectURL(state.photoPreview);
    setStep(0);
    setCelebrate(false);
    setState({
      name: '',
      kind: 'PRODUCT',
      photo: null,
      photoPreview: null,
      photoBlur: null,
      categoryId: null,
      newCategoryName: '',
      newCategoryIcon: null,
      price: '',
      compareAt: '',
      cost: '',
      description: '',
      stockTracked: false,
      stock: '',
      promoOn: false,
      promoValue: '',
      promoEnds: '',
    });
  }

  function goStep(next: number) {
    setStep(next);
    // Focus lands on the next question's field after paint (no layout motion).
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  }

  const lastStep = WIZARD_STEPS.length - 1;
  const blocker = validateWizardStep(step, state);

  async function pickPhoto(file: File | null) {
    if (!file) return;
    const problem = validateImageFile(file, 'item');
    if (problem) {
      toast.error(problem);
      return;
    }
    setCropFile(file);
    setCropOpen(true);
  }

  async function acceptCrop(blob: Blob) {
    const file = new File([blob], 'product.webp', { type: blob.type || 'image/webp' });
    if (state.photoPreview) URL.revokeObjectURL(state.photoPreview);
    const [blur, preview] = [await makeBlurPlaceholder(file), URL.createObjectURL(file)];
    set({ photo: file, photoPreview: preview, photoBlur: blur });
  }

  function chip(label: string, detail: string, target: number) {
    return (
      <button
        key={label}
        type="button"
        onClick={() => goStep(target)}
        className="flex w-full items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-left transition-colors hover:bg-muted"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check aria-hidden className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-small">
          <span className="font-semibold">{label}:</span> {detail}
        </span>
      </button>
    );
  }

  async function persist(active: boolean): Promise<boolean> {
    for (const gate of [0, 2, 3, 5, 6]) {
      const problem = validateWizardStep(gate, state);
      if (problem) {
        toast.error(problem);
        return false;
      }
    }
    setBusy(true);
    try {
      let categoryId = state.categoryId === NEW_CATEGORY ? null : state.categoryId;
      if (state.categoryId === NEW_CATEGORY) {
        const created: CategoryRecord = await apiFetch('/api/store/categories', {
          method: 'POST',
          body: JSON.stringify({ name: state.newCategoryName.trim(), icon: state.newCategoryIcon }),
          schema: CategorySchema,
        });
        categoryId = created.id;
      }
      const pricePesewas = parseCedis(state.price) ?? 0;
      const item: StoreItemRecord = await apiFetch('/api/store/items', {
        method: 'POST',
        body: JSON.stringify({
          name: state.name.trim(),
          kind: state.kind,
          description: state.description.trim() ? state.description.trim() : undefined,
          categoryId,
          pricePesewas,
          costPricePesewas: state.cost.trim() ? parseCedis(state.cost) : undefined,
          compareAtPricePesewas: state.compareAt.trim() ? parseCedis(state.compareAt) : undefined,
          active,
          stock: state.stockTracked ? Number.parseInt(state.stock, 10) : null,
        }),
        schema: StoreItemSchema,
      });
      if (state.photo) {
        const compressed = await fitImageFile(state.photo, 'item');
        await uploadImageFile(
          `/api/store/items/${item.id}/image`,
          compressed,
          state.photo.name,
          StoreItemSchema,
        );
      }
      if (state.promoOn) {
        const promo: PromotionRecord = await apiFetch('/api/store/promotions', {
          method: 'POST',
          body: JSON.stringify({
            name: `${state.name.trim()} launch`,
            kind: 'PERCENT',
            value: Number.parseInt(state.promoValue, 10),
            itemIds: [item.id],
            endsAt: state.promoEnds || undefined,
          }),
          schema: PromotionSchema,
        });
        void promo;
      }
      return true;
    } catch (error) {
      const body =
        error instanceof Error ? (error.cause as { errors?: Record<string, string> }) : null;
      const first = body?.errors ? Object.values(body.errors)[0] : null;
      toast.error(first ?? 'Could not save the product');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function publish(active: boolean) {
    if (await persist(active)) {
      setCelebrate(true);
      toast.success(active ? 'Live on your page!' : 'Saved as a hidden draft');
      setTimeout(() => {
        onSaved();
        reset();
        onOpenChange(false);
      }, 900);
    }
  }

  const pricePesewas = parseCedis(state.price) ?? 0;
  const comparePesewas = state.compareAt.trim() ? (parseCedis(state.compareAt) ?? null) : null;
  const previewDiscount = discountPct(pricePesewas, comparePesewas);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-xl">
        <style>{`
          @keyframes wizard-pop {
            0% { transform: scale(0.4); opacity: 0; }
            60% { transform: scale(1.12); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .wizard-pop { animation: none !important; }
          }
        `}</style>
        <DialogHeader>
          <DialogTitle className="text-h3">Add a product</DialogTitle>
          <DialogDescription>
            Step {Math.min(step + 1, WIZARD_STEPS.length)} of {WIZARD_STEPS.length} —{' '}
            {WIZARD_STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={WIZARD_STEPS.length}
          aria-valuenow={Math.min(step + 1, WIZARD_STEPS.length)}
          aria-label="Product setup progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{
              width: `${(Math.min(step + 1, WIZARD_STEPS.length) / WIZARD_STEPS.length) * 100}%`,
            }}
          />
        </div>

        {celebrate ? (
          <div className="grid place-items-center gap-3 py-10 text-center">
            <span className="wizard-pop motion-safe:[animation:wizard-pop_0.5s_ease-out] flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check aria-hidden className="size-8" />
            </span>
            <p className="font-display text-h3">On the shelf!</p>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (blocker || busy) {
                if (blocker) toast.error(blocker);
                return;
              }
              if (step < lastStep) goStep(step + 1);
            }}
            className="grid gap-3"
          >
            {step > 0 && state.name.trim() && chip('Name', state.name.trim(), 0)}
            {step > 2 &&
              chip(
                'Shelf',
                state.categoryId === NEW_CATEGORY
                  ? state.newCategoryName.trim() || 'New shelf'
                  : (categories.find((c) => c.id === state.categoryId)?.name ?? 'Uncategorised'),
                2,
              )}
            {step > 3 && chip('Price', formatGhs(pricePesewas), 3)}

            <div
              key={step}
              className="grid gap-4 rounded-xl border border-border bg-card p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-300 sm:p-5"
            >
              {step === 0 && (
                <>
                  <fieldset className="grid gap-2">
                    <legend className="text-sm font-medium">Product or service</legend>
                    {(['PRODUCT', 'SERVICE'] as const).map((kind) => (
                      <Button
                        key={kind}
                        type="button"
                        variant={state.kind === kind ? 'default' : 'outline'}
                        aria-pressed={state.kind === kind}
                        onClick={() => set({ kind })}
                        className="h-11 rounded-md font-semibold"
                      >
                        {kind === 'PRODUCT' ? 'It’s a product' : 'It’s a service'}
                      </Button>
                    ))}
                  </fieldset>
                  <div className="grid gap-2">
                    <Label htmlFor="wiz-name">What are you selling?</Label>
                    <Input
                      id="wiz-name"
                      ref={firstFieldRef}
                      value={state.name}
                      onChange={(event) => set({ name: event.target.value })}
                      placeholder="Beaded clutch"
                      className="h-12 rounded-md text-base"
                    />
                  </div>
                </>
              )}

              {step === 1 && (
                <div className="grid gap-3">
                  <Label>
                    Show it off{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  {state.photoPreview ? (
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted">
                      {state.photoBlur && (
                        <img
                          src={state.photoBlur}
                          alt=""
                          aria-hidden
                          className="absolute inset-0 size-full object-cover blur-md"
                        />
                      )}
                      <img
                        src={state.photoPreview}
                        alt={state.name || 'Product preview'}
                        className="absolute inset-0 size-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (state.photoPreview) URL.revokeObjectURL(state.photoPreview);
                          set({ photo: null, photoPreview: null, photoBlur: null });
                        }}
                        className="absolute right-2 top-2 h-9 rounded-md bg-card/90 px-3 text-small font-semibold"
                      >
                        Retake
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor="wiz-photo"
                      className="grid min-h-36 cursor-pointer place-items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center"
                    >
                      <ImagePlus aria-hidden className="size-8 text-primary" />
                      <span className="text-small font-semibold">Tap to add a photo</span>
                      <span className="text-caption text-muted-foreground">
                        Camera or gallery — you’ll frame it next
                      </span>
                      <input
                        id="wiz-photo"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          event.target.value = '';
                          void pickPhoto(file);
                        }}
                      />
                    </label>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-2">
                  <Label>Which shelf does it sit on?</Label>
                  <div className="grid gap-2">
                    {categories.map((category) => (
                      <Button
                        key={category.id}
                        type="button"
                        variant={state.categoryId === category.id ? 'default' : 'outline'}
                        aria-pressed={state.categoryId === category.id}
                        onClick={() => set({ categoryId: category.id })}
                        className="h-11 justify-start rounded-md font-semibold"
                      >
                        {category.name}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant={state.categoryId === null ? 'default' : 'outline'}
                      aria-pressed={state.categoryId === null}
                      onClick={() => set({ categoryId: null })}
                      className="h-11 justify-start rounded-md font-semibold"
                    >
                      No shelf (uncategorised)
                    </Button>
                    <Button
                      type="button"
                      variant={state.categoryId === NEW_CATEGORY ? 'default' : 'outline'}
                      aria-pressed={state.categoryId === NEW_CATEGORY}
                      onClick={() => set({ categoryId: NEW_CATEGORY })}
                      className="h-11 justify-start rounded-md font-semibold"
                    >
                      + New shelf…
                    </Button>
                  </div>
                  {state.categoryId === NEW_CATEGORY && (
                    <div className="grid gap-2 rounded-xl border border-border p-3">
                      <Label htmlFor="wiz-newcat">New shelf name</Label>
                      <Input
                        id="wiz-newcat"
                        value={state.newCategoryName}
                        onChange={(event) => set({ newCategoryName: event.target.value })}
                        placeholder="Drinks"
                        className="h-11 rounded-md"
                      />
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="wiz-price">Price (GH₵)</Label>
                      <Input
                        id="wiz-price"
                        inputMode="decimal"
                        value={state.price}
                        onChange={(event) => set({ price: event.target.value })}
                        placeholder="45.50"
                        className="h-12 rounded-md text-base"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="wiz-was">
                        Was price <span className="font-normal text-muted-foreground">(sale)</span>
                      </Label>
                      <Input
                        id="wiz-was"
                        inputMode="decimal"
                        value={state.compareAt}
                        onChange={(event) => set({ compareAt: event.target.value })}
                        placeholder="60.00"
                        className="h-12 rounded-md text-base"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="wiz-cost">
                      What it costs you{' '}
                      <span className="font-normal text-muted-foreground">(for margins)</span>
                    </Label>
                    <Input
                      id="wiz-cost"
                      inputMode="decimal"
                      value={state.cost}
                      onChange={(event) => set({ cost: event.target.value })}
                      placeholder="20.00"
                      className="h-11 rounded-md"
                    />
                  </div>
                </>
              )}

              {step === 4 && (
                <div className="grid gap-2">
                  <Label htmlFor="wiz-desc">
                    Describe it{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="wiz-desc"
                    value={state.description}
                    onChange={(event) => set({ description: event.target.value })}
                    placeholder="One colour, printed on demand in Accra."
                    rows={4}
                    className="rounded-md"
                  />
                </div>
              )}

              {step === 5 && (
                <div className="grid gap-2">
                  <Label>Track stock?</Label>
                  <fieldset className="grid grid-cols-2 gap-2">
                    <legend className="text-sm font-medium">Stock tracking</legend>
                    <Button
                      type="button"
                      variant={!state.stockTracked ? 'default' : 'outline'}
                      aria-pressed={!state.stockTracked}
                      onClick={() => set({ stockTracked: false })}
                      className="h-11 rounded-md font-semibold"
                    >
                      No, skip it
                    </Button>
                    <Button
                      type="button"
                      variant={state.stockTracked ? 'default' : 'outline'}
                      aria-pressed={state.stockTracked}
                      onClick={() => set({ stockTracked: true })}
                      className="h-11 rounded-md font-semibold"
                    >
                      Yes, count it
                    </Button>
                  </fieldset>
                  {state.stockTracked && (
                    <div className="grid gap-2">
                      <Label htmlFor="wiz-stock">Units on hand</Label>
                      <Input
                        id="wiz-stock"
                        inputMode="numeric"
                        value={state.stock}
                        onChange={(event) => set({ stock: event.target.value })}
                        placeholder="20"
                        className="h-11 rounded-md"
                      />
                      <p className="text-xs text-muted-foreground">
                        The page shows “Only a few left” under 6 and hides ordering at 0.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {step === 6 && (
                <div className="grid gap-3">
                  <fieldset className="grid grid-cols-2 gap-2">
                    <legend className="text-sm font-medium">Launch promo</legend>
                    <Button
                      type="button"
                      variant={!state.promoOn ? 'default' : 'outline'}
                      aria-pressed={!state.promoOn}
                      onClick={() => set({ promoOn: false })}
                      className="h-11 rounded-md font-semibold"
                    >
                      No promo
                    </Button>
                    <Button
                      type="button"
                      variant={state.promoOn ? 'default' : 'outline'}
                      aria-pressed={state.promoOn}
                      onClick={() => set({ promoOn: true })}
                      className="h-11 rounded-md font-semibold"
                    >
                      Add launch %
                    </Button>
                  </fieldset>
                  {state.promoOn && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="wiz-promo">Percent off</Label>
                        <Input
                          id="wiz-promo"
                          inputMode="numeric"
                          value={state.promoValue}
                          onChange={(event) => set({ promoValue: event.target.value })}
                          placeholder="20"
                          className="h-11 rounded-md"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="wiz-promo-ends">
                          Ends <span className="font-normal text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="wiz-promo-ends"
                          type="date"
                          value={state.promoEnds}
                          onChange={(event) => set({ promoEnds: event.target.value })}
                          className="h-11 rounded-md"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === lastStep && (
                <div className="grid gap-3">
                  <div className="overflow-hidden rounded-xl border border-border">
                    {state.photoPreview ? (
                      <div className="relative aspect-[4/3] bg-muted">
                        <img
                          src={state.photoPreview}
                          alt=""
                          className="absolute inset-0 size-full object-cover"
                        />
                        {previewDiscount != null && (
                          <span className="absolute left-2 top-2 rounded-full bg-destructive px-2.5 py-0.5 text-caption font-semibold text-white">
                            -{previewDiscount}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="grid aspect-[4/3] place-items-center bg-muted text-caption text-muted-foreground">
                        No photo — shoppers see a placeholder tile
                      </div>
                    )}
                    <div className="p-4">
                      <p className="truncate font-display text-base font-semibold">
                        {state.name.trim() || 'Untitled'}
                      </p>
                      <p className="mt-1 flex items-baseline gap-2">
                        <span className="font-mono text-base font-semibold">
                          {formatGhs(pricePesewas)}
                        </span>
                        {comparePesewas != null && (
                          <span className="text-small text-muted-foreground line-through">
                            {formatGhs(comparePesewas)}
                          </span>
                        )}
                      </p>
                      {state.promoOn && (
                        <p className="mt-1 text-caption font-semibold text-primary">
                          Launch promo: {state.promoValue || '…'}% off
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={step === 0 || busy}
                  onClick={() => goStep(Math.max(0, step - 1))}
                  className="h-11 rounded-md font-semibold"
                >
                  <ArrowLeft aria-hidden className="size-4" /> Back
                </Button>
                {step < lastStep ? (
                  <Button
                    type="submit"
                    disabled={busy || blocker != null}
                    title={blocker ?? undefined}
                    className="h-11 rounded-md px-6 font-semibold active:scale-[0.98]"
                  >
                    Next <ArrowRight aria-hidden className="size-4" />
                  </Button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void publish(false)}
                      className="h-11 rounded-md font-semibold"
                    >
                      Save as draft
                    </Button>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void publish(true)}
                      className="h-11 rounded-md px-6 font-semibold active:scale-[0.98]"
                    >
                      {busy ? 'Publishing…' : 'Publish'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </form>
        )}
      </DialogContent>
      <CropDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        file={cropFile}
        onCropped={(blob) => void acceptCrop(blob)}
      />
    </Dialog>
  );
}
