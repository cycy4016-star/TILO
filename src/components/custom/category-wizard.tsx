// New-category wizard: name, icon, cover — then straight into the catalogue.
// Create-only; edits keep the existing CategoryForm dialog.
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
import { CATEGORY_ICONS } from '@/lib/category-icons';
import { type CategoryRecord, CategoryRecord as CategorySchema } from '@/lib/contracts/category';
import { fitImageFile, validateImageFile } from '@/lib/image';
import { uploadImageFile } from '@/lib/uploads';

export function CategoryWizard({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (category: CategoryRecord) => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [cover, setCover] = useState<ImageSelection>(emptyImageSelection);
  const [busy, setBusy] = useState(false);

  function reset() {
    setName('');
    setIcon(null);
    setCover(emptyImageSelection);
  }

  async function save() {
    if (!name.trim()) {
      toast.error('Give the shelf a name');
      return;
    }
    if (cover.file) {
      const problem = validateImageFile(cover.file, 'item');
      if (problem) {
        toast.error(problem);
        return;
      }
    }
    setBusy(true);
    try {
      let saved = await apiFetch('/api/store/categories', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), icon }),
        schema: CategorySchema,
      });
      if (cover.file) {
        const compressed = await fitImageFile(cover.file, 'cover');
        saved = await uploadImageFile(
          `/api/store/categories/${saved.id}/cover`,
          compressed,
          cover.file.name,
          CategorySchema,
        );
      }
      onSaved(saved);
      toast.success(`Shelf “${saved.name}” is ready`);
      reset();
      onOpenChange(false);
    } catch (error) {
      const body =
        error instanceof Error ? (error.cause as { errors?: Record<string, string> }) : null;
      toast.error(body?.errors?.name ?? 'Could not create the shelf');
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
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-h3">New shelf</DialogTitle>
          <DialogDescription>
            A heading shoppers browse by — Beads, Wall art, Drinks.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="catwiz-name">Shelf name</Label>
            <Input
              id="catwiz-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Beads, Wall art, Drinks…"
              className="h-11 rounded-md"
            />
          </div>
          <div className="grid gap-2">
            <span id="catwiz-icon-label" className="text-sm font-medium" aria-hidden>
              Icon <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <fieldset className="grid grid-cols-7 gap-1.5" aria-labelledby="catwiz-icon-label">
              <legend className="sr-only">Shelf icon</legend>
              {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
                <Button
                  key={key}
                  type="button"
                  variant={icon === key ? 'default' : 'outline'}
                  aria-pressed={icon === key}
                  aria-label={`${key} icon`}
                  onClick={() => setIcon((current) => (current === key ? null : key))}
                  className="size-11 rounded-md p-0"
                >
                  <Icon aria-hidden className="size-5" />
                </Button>
              ))}
            </fieldset>
          </div>
          <div className="grid gap-2">
            <Label>
              Cover photo <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <ImagePicker currentUrl={null} value={cover} onChange={setCover} />
          </div>
          <Button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => void save()}
            className="h-11 rounded-md font-semibold active:scale-[0.98]"
          >
            {busy ? 'Creating…' : 'Create shelf'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
