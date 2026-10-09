// Photo cropper: frame a picked photo in a preset aspect (centred default),
// drag to pan, slider to zoom, output a cropped WebP blob. Transform-only
// preview; reduced motion skips the settle transition.
'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export type CropAspect = '1:1' | '4:5' | '9:16' | '1.91:1';

export const CROP_ASPECTS: { value: CropAspect; label: string; ratio: number }[] = [
  { value: '1:1', label: 'Square', ratio: 1 },
  { value: '4:5', label: 'Portrait', ratio: 4 / 5 },
  { value: '9:16', label: 'Story', ratio: 9 / 16 },
  { value: '1.91:1', label: 'Wide', ratio: 1.91 },
];

export function CropDialog({
  open,
  onOpenChange,
  file,
  onCropped,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  onCropped: (blob: Blob) => void;
}) {
  const [aspect, setAspect] = useState<CropAspect>('4:5');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!file || !open) {
      setSource(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setSource(img);
    img.src = url;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => {
      URL.revokeObjectURL(url);
      setSource(null);
    };
  }, [file, open]);

  const ratio = CROP_ASPECTS.find((entry) => entry.value === aspect)?.ratio ?? 4 / 5;

  function pointerDown(event: React.PointerEvent) {
    setDragging(true);
    lastRef.current = { x: event.clientX, y: event.clientY };
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function pointerMove(event: React.PointerEvent) {
    if (!dragging || !frameRef.current) return;
    const frame = frameRef.current.getBoundingClientRect();
    const limit = Math.min(frame.width, frame.height) / 2;
    setOffset((current) => ({
      x: Math.max(-limit, Math.min(limit, current.x + event.clientX - lastRef.current.x)),
      y: Math.max(-limit, Math.min(limit, current.y + event.clientY - lastRef.current.y)),
    }));
    lastRef.current = { x: event.clientX, y: event.clientY };
  }

  async function apply() {
    if (!source) return;
    // Cover-fit the source into the frame, then cut the frame out.
    const frameWidth = 900;
    const frameHeight = Math.round(frameWidth / ratio);
    const cover = Math.max(frameWidth / source.naturalWidth, frameHeight / source.naturalHeight);
    const drawWidth = source.naturalWidth * cover * zoom;
    const drawHeight = source.naturalHeight * cover * zoom;
    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(
      source,
      frameWidth / 2 - drawWidth / 2 + offset.x * cover * zoom,
      frameHeight / 2 - drawHeight / 2 + offset.y * cover * zoom,
      drawWidth,
      drawHeight,
    );
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), 'image/webp', 0.85),
    );
    if (blob && blob.size > 0) {
      onCropped(blob);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-h3">Frame the photo</DialogTitle>
          <DialogDescription>Drag to pan, zoom to fill, pick a shape.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Frame shape</legend>
            {CROP_ASPECTS.map((entry) => (
              <Button
                key={entry.value}
                type="button"
                variant={aspect === entry.value ? 'default' : 'outline'}
                onClick={() => setAspect(entry.value)}
                aria-pressed={aspect === entry.value}
                className="h-10 rounded-md px-4 text-small font-semibold"
              >
                {entry.label} · {entry.value}
              </Button>
            ))}
          </fieldset>
          <div
            ref={frameRef}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            className="relative mx-auto w-full max-w-72 cursor-grab touch-none overflow-hidden rounded-xl border border-border bg-muted active:cursor-grabbing"
            style={{ aspectRatio: String(ratio) }}
            role="application"
            aria-label="Photo frame — drag to reposition"
          >
            {source && (
              <img
                src={source.src}
                alt=""
                draggable={false}
                className="absolute left-1/2 top-1/2 max-h-none max-w-none select-none"
                style={{
                  width: `${Math.max(100, 100 * zoom)}%`,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                }}
              />
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="crop-zoom">Zoom</Label>
            <input
              id="crop-zoom"
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="h-11 w-full accent-primary"
            />
          </div>
          <Button
            type="button"
            disabled={!source}
            onClick={() => void apply()}
            className="h-11 rounded-md font-semibold active:scale-[0.98]"
          >
            Use this framing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
