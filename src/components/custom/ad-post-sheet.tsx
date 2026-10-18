// Where an ad goes. Picking a channel opens whatever that network offers on
// the web — a composer for chats and link posts, or (for image-first networks
// with no web poster) a saved image plus a copied caption for the app. The full
// caption is always shown so the owner can grab it by hand.
'use client';

import {
  Copy,
  Download,
  Facebook,
  Instagram,
  type LucideIcon,
  MessageCircle,
  Music2,
  Send,
  Twitter,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AdChannelPreview } from '@/components/custom/ad-channel-preview';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AD_CHANNELS, type AdChannel, adPostPlan } from '@/lib/ads';

export const CHANNEL_ICONS: Record<AdChannel, LucideIcon> = {
  whatsapp: MessageCircle,
  facebook: Facebook,
  instagram: Instagram,
  tiktok: Music2,
  x: Twitter,
  telegram: Send,
};

/** Save the generated ad image to the device (same-origin fetch → blob). */
export async function downloadAdImage(imageUrl: string, imageName: string): Promise<void> {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = imageName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
  }
}

export async function copyAdCaption(caption: string): Promise<void> {
  await navigator.clipboard.writeText(caption);
}

export function AdPostSheet({
  open,
  onOpenChange,
  title,
  description,
  caption,
  url,
  imageUrl,
  imageName,
  storeName,
  storeSlug,
  itemName,
  imageAspect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  caption: string;
  url: string;
  imageUrl: string;
  imageName: string;
  storeName: string;
  storeSlug: string;
  itemName: string;
  imageAspect: string;
}) {
  const [busy, setBusy] = useState<AdChannel | null>(null);

  async function select(channel: AdChannel) {
    const plan = adPostPlan(channel, caption);
    setBusy(channel);
    try {
      if (plan.saveImage) await downloadAdImage(imageUrl, imageName);
      if (plan.copyCaption) {
        try {
          await copyAdCaption(caption);
        } catch {
          // Clipboard blocked — the note still tells them to paste by hand.
        }
      }
      if (plan.href) {
        const opened = window.open(plan.href, '_blank', 'noopener,noreferrer');
        if (!opened) window.location.href = plan.href;
      }
      toast.success(plan.note);
      onOpenChange(false);
    } finally {
      setBusy(null);
    }
  }

  async function saveImage() {
    await downloadAdImage(imageUrl, imageName);
    toast.success('Ad image saved');
  }

  async function copyCaption() {
    try {
      await copyAdCaption(caption);
      toast.success('Caption copied — paste it anywhere');
    } catch {
      toast.error('Copy failed — select the caption and copy it yourself');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-h3">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <AdChannelPreview
          storeName={storeName}
          storeSlug={storeSlug}
          caption={caption}
          imageUrl={imageUrl}
          imageAspect={imageAspect}
          itemName={itemName}
          url={url}
        />
        <div className="grid gap-2 border-t border-border pt-3">
          {AD_CHANNELS.map((channel) => {
            const Icon = CHANNEL_ICONS[channel.key];
            return (
              <Button
                key={channel.key}
                type="button"
                variant="outline"
                onClick={() => void select(channel.key)}
                disabled={busy !== null}
                className="h-11 justify-start gap-3 rounded-md font-semibold"
              >
                <Icon aria-hidden className="size-4" />
                Post on {channel.label}
                <span className="ml-auto text-caption font-normal text-muted-foreground">
                  {channel.mode === 'compose' ? 'Opens with caption' : 'Saves image'}
                </span>
              </Button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void saveImage()}
            className="h-10 rounded-md font-semibold"
          >
            <Download aria-hidden className="size-4" /> Save image
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void copyCaption()}
            className="h-10 rounded-md font-semibold"
          >
            <Copy aria-hidden className="size-4" /> Copy caption
          </Button>
        </div>
        <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/40 p-3">
          <p className="whitespace-pre-wrap text-caption text-muted-foreground">{caption}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
