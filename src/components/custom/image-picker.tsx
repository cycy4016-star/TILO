// Image capture + upload picker used by the store manager (item photos, store
// logo) and the profile page (avatar). Handles: live camera capture on phones,
// gallery pick, preview of the current image, preview of the newly chosen one,
// and removing a photo. Parent keeps the selection and does the actual upload.
'use client';

import { Camera, Image as ImageIcon, ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export type ImageSelection = {
  // A newly chosen file (already client-compressed by the caller if desired).
  file: File | null;
  // true = the current image should be deleted on save (remove action).
  cleared: boolean;
};

export const emptyImageSelection: ImageSelection = { file: null, cleared: false };

export function ImagePicker({
  currentUrl,
  value,
  onChange,
  shape = 'square',
}: {
  /** URL of the image currently on the server, or null when none exists. */
  currentUrl: string | null;
  value: ImageSelection;
  onChange: (next: ImageSelection) => void;
  shape?: 'square' | 'circle';
}) {
  const captureRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value.file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file]);

  const shownUrl = preview ?? (value.cleared ? null : currentUrl);
  const hasSomething = Boolean(value.file || (!value.cleared && currentUrl));

  function pick(file: File | null) {
    onChange({ file, cleared: false });
  }

  function remove() {
    if (value.file) {
      onChange({ file: null, cleared: false });
      return;
    }
    onChange({ file: null, cleared: !value.cleared });
  }

  const previewClass =
    shape === 'circle'
      ? 'size-20 shrink-0 overflow-hidden rounded-full ring-2 ring-amber-950/20'
      : 'size-20 shrink-0 overflow-hidden rounded-2xl';

  return (
    <div className="flex items-center gap-4">
      <div className={previewClass}>
        {shownUrl ? (
          <img src={shownUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-amber-50 text-amber-400 dark:bg-stone-800">
            <ImageIcon aria-hidden className="size-8" />
          </div>
        )}
      </div>
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={captureRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            aria-label="Take a photo"
            onChange={(event) => pick(event.target.files?.[0] ?? null)}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Choose a photo"
            onChange={(event) => pick(event.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-full text-xs font-black uppercase tracking-wide"
            onClick={() => captureRef.current?.click()}
          >
            <Camera aria-hidden className="size-3.5" /> Take photo
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-full text-xs font-black uppercase tracking-wide"
            onClick={() => galleryRef.current?.click()}
          >
            <ImagePlus aria-hidden className="size-3.5" /> Choose image
          </Button>
        </div>
        {hasSomething ? (
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-fit rounded-full text-xs font-black uppercase tracking-wide text-red-600 hover:text-red-700"
            onClick={remove}
          >
            <Trash2 aria-hidden className="size-3.5" />
            {value.cleared ? 'Undo remove' : 'Remove photo'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
