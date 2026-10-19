// Dashboard photo manager for one catalogue item. Uploads append to the
// gallery, the first photo is the cover, and the seller can promote or delete
// any photo. Every action is written immediately so the public page updates
// without a separate "save gallery" step.
'use client';

import { ImagePlus, Loader2, Star, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import {
  type StoreItem as StoreItemRecord,
  StoreItemRecord as StoreItemSchema,
} from '@/lib/contracts/store';
import { fitImageFile, validateImageFile } from '@/lib/image';
import { MAX_ITEM_PHOTOS } from '@/lib/item-images';
import { uploadImageFile } from '@/lib/uploads';

function photoUrl(itemId: string, imageId: string, updatedAt: string): string {
  return `/api/public/store/items/${itemId}/images/${imageId}?t=${Date.parse(updatedAt)}`;
}

export function ItemGalleryEditor({
  item,
  onChanged,
}: {
  item: StoreItemRecord;
  onChanged: (item: StoreItemRecord) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const full = item.imageIds.length >= MAX_ITEM_PHOTOS;

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_ITEM_PHOTOS - item.imageIds.length;
    const picked = Array.from(files);
    if (picked.length > room) {
      toast.error(`You can add ${room} more photo${room === 1 ? '' : 's'} to this product.`);
    }
    setBusy(true);
    let saved = item;
    try {
      for (const file of picked.slice(0, Math.max(0, room))) {
        const problem = validateImageFile(file, 'item');
        if (problem) {
          toast.error(problem);
          continue;
        }
        const compressed = await fitImageFile(file, 'item');
        saved = await uploadImageFile(
          `/api/store/items/${item.id}/images`,
          compressed,
          file.name || 'photo.jpg',
          StoreItemSchema,
        );
        onChanged(saved);
      }
    } catch {
      toast.error('Could not upload that photo');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function makeCover(imageId: string) {
    setBusy(true);
    try {
      const saved = await apiFetch(`/api/store/items/${item.id}/images/${imageId}`, {
        method: 'PUT',
        schema: StoreItemSchema,
      });
      onChanged(saved);
    } catch {
      toast.error('Could not update the cover photo');
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(imageId: string) {
    setBusy(true);
    try {
      const saved = await apiFetch(`/api/store/items/${item.id}/images/${imageId}`, {
        method: 'DELETE',
        schema: StoreItemSchema,
      });
      onChanged(saved);
    } catch {
      toast.error('Could not remove that photo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {item.imageIds.map((imageId, index) => (
          <div
            key={imageId}
            className="group relative size-20 overflow-hidden rounded-xl border border-border bg-muted"
          >
            <img
              src={photoUrl(item.id, imageId, item.updatedAt)}
              alt={index === 0 ? 'Cover photo' : `Photo ${index + 1}`}
              className="size-full object-cover"
            />
            {index === 0 ? (
              <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                Cover
              </span>
            ) : null}
            <div className="absolute inset-x-1 bottom-1 flex items-center justify-between">
              {index > 0 ? (
                <button
                  type="button"
                  aria-label={`Make photo ${index + 1} the cover`}
                  disabled={busy}
                  onClick={() => void makeCover(imageId)}
                  className="grid size-6 place-items-center rounded-md bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75 disabled:opacity-50"
                >
                  <Star aria-hidden className="size-3.5" />
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                aria-label={`Remove photo ${index + 1}`}
                disabled={busy}
                onClick={() => void removePhoto(imageId)}
                className="grid size-6 place-items-center rounded-md bg-black/55 text-white backdrop-blur transition-colors hover:bg-destructive disabled:opacity-50"
              >
                <Trash2 aria-hidden className="size-3.5" />
              </button>
            </div>
          </div>
        ))}

        {!full ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="grid size-20 place-items-center gap-1 rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
          >
            {busy ? (
              <Loader2 aria-hidden className="size-5 animate-spin" />
            ) : (
              <ImagePlus aria-hidden className="size-5" />
            )}
            <span className="text-[11px] font-semibold">Add photo</span>
          </button>
        ) : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label="Add product photos"
        onChange={(event) => void addPhotos(event.target.files)}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Up to {MAX_ITEM_PHOTOS} photos. The first one is the cover shoppers see first; tap the
          star to promote another.
        </p>
        {item.imageIds.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            className="h-8 shrink-0 rounded-md px-2 text-xs"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Add more
          </Button>
        ) : null}
      </div>
    </div>
  );
}
