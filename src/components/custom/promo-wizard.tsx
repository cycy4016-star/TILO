// New-promo wizard: name, discount, targets, schedule — then live on the
// page. Create-only; edits keep the existing PromoForm dialog. Empty targets
// mean store-wide.
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api-client';
import {
  type PromotionRecord,
  PromotionRecord as PromotionSchema,
} from '@/lib/contracts/promotion';
import { fitImageFile, validateImageFile } from '@/lib/image';
import { uploadImageFile } from '@/lib/uploads';

export function PromoWizard({
  open,
  onOpenChange,
  onSaved,
  items,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (promo: PromotionRecord) => void;
  items: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [bannerText, setBannerText] = useState('');
  const [image, setImage] = useState<ImageSelection>(emptyImageSelection);
  const [busy, setBusy] = useState(false);

  function toggle(list: string[], id: string, set: (next: string[]) => void) {
    set(list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]);
  }

  function reset() {
    setName('');
    setKind('PERCENT');
    setValue('');
    setCode('');
    setItemIds([]);
    setCategoryIds([]);
    setStartsAt('');
    setEndsAt('');
    setBannerText('');
    setImage(emptyImageSelection);
  }

  async function save() {
    if (!name.trim()) {
      toast.error('Give the promo a name');
      return;
    }
    const numeric =
      kind === 'PERCENT' ? Number.parseInt(value, 10) : Math.round(Number.parseFloat(value) * 100);
    if (!Number.isFinite(numeric) || numeric < 1 || (kind === 'PERCENT' && numeric > 100)) {
      toast.error(
        kind === 'PERCENT'
          ? 'Enter the discount as a whole percentage between 1 and 100'
          : 'Enter a valid discount amount in cedis (e.g. 5)',
      );
      return;
    }
    if (image.file) {
      const problem = validateImageFile(image.file, 'promo');
      if (problem) {
        toast.error(problem);
        return;
      }
    }
    setBusy(true);
    try {
      let saved = await apiFetch('/api/store/promotions', {
        method: 'POST',
        body: JSON.stringify({
          name: bannerText.trim() ? `${name.trim()} — ${bannerText.trim()}` : name.trim(),
          kind,
          value: numeric,
          code: code.trim() ? code.trim() : undefined,
          itemIds,
          categoryIds,
          startsAt: startsAt || undefined,
          endsAt: endsAt || undefined,
        }),
        schema: PromotionSchema,
      });
      if (image.file) {
        const compressed = await fitImageFile(image.file, 'promo');
        saved = await uploadImageFile(
          `/api/store/promotions/${saved.id}/image`,
          compressed,
          image.file.name,
          PromotionSchema,
        );
      }
      onSaved(saved);
      toast.success(`Promo “${saved.name}” is live`);
      reset();
      onOpenChange(false);
    } catch (error) {
      const body =
        error instanceof Error ? (error.cause as { errors?: Record<string, string> }) : null;
      const first = body?.errors ? Object.values(body.errors)[0] : null;
      toast.error(first ?? 'Could not create the promo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-h3">New sale</DialogTitle>
          <DialogDescription>
            A discount with targets and a schedule. Empty targets mean store-wide.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="promowiz-name">Promo name</Label>
            <Input
              id="promowiz-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Mid-sem sale"
              className="h-11 rounded-md"
            />
          </div>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">Discount type</legend>
            {(['PERCENT', 'FIXED'] as const).map((option) => (
              <Button
                key={option}
                type="button"
                variant={kind === option ? 'default' : 'outline'}
                aria-pressed={kind === option}
                onClick={() => setKind(option)}
                className="h-11 rounded-md font-semibold"
              >
                {option === 'PERCENT' ? '% off' : 'GH₵ off'}
              </Button>
            ))}
          </fieldset>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="promowiz-value">
                {kind === 'PERCENT' ? 'Percent off' : 'Cedis off'}
              </Label>
              <Input
                id="promowiz-value"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={kind === 'PERCENT' ? '20' : '5'}
                className="h-11 rounded-md"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="promowiz-code">
                Code <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="promowiz-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="STUDENT10"
                className="h-11 rounded-md font-mono"
              />
            </div>
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">
              Applies to{' '}
              <span className="font-normal text-muted-foreground">(empty = whole store)</span>
            </legend>
            <div className="grid max-h-40 gap-1 overflow-y-auto rounded-md border border-border p-2">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={categoryIds.includes(category.id)}
                    onChange={() => toggle(categoryIds, category.id, setCategoryIds)}
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
                    onChange={() => toggle(itemIds, item.id, setItemIds)}
                    className="size-4 accent-primary"
                  />
                  <span className="text-small">{item.name}</span>
                </label>
              ))}
              {items.length === 0 && categories.length === 0 && (
                <p className="p-2 text-small text-muted-foreground">
                  No catalogue yet — it will apply store-wide.
                </p>
              )}
            </div>
          </fieldset>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="promowiz-starts">
                Starts <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="promowiz-starts"
                type="date"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className="h-11 rounded-md"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="promowiz-ends">
                Ends <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="promowiz-ends"
                type="date"
                value={endsAt}
                min={startsAt || undefined}
                onChange={(event) => setEndsAt(event.target.value)}
                className="h-11 rounded-md"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="promowiz-banner">
              Banner text <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="promowiz-banner"
              value={bannerText}
              onChange={(event) => setBannerText(event.target.value)}
              placeholder="This weekend only!"
              className="h-11 rounded-md"
            />
          </div>
          <div className="grid gap-2">
            <Label>
              Banner image <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <ImagePicker currentUrl={null} value={image} onChange={setImage} />
          </div>
          <Button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => void save()}
            className="h-11 rounded-md font-semibold active:scale-[0.98]"
          >
            {busy ? 'Launching…' : 'Launch sale'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
