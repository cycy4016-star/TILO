// Share sheet: one dialog for passing a shop, product or promo around —
// WhatsApp first (the channel that actually sells), then copy link, the
// social intents, the native sheet where available, and the branded share
// image download when the caller has one.
'use client';

import {
  Check,
  Copy,
  Download,
  Facebook,
  MessageCircle,
  Send,
  Share2,
  Twitter,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { canNativeShare, type ShareChannel, shareTargetFor, shareUrlWithRef } from '@/lib/share';

const CHANNELS: { channel: Exclude<ShareChannel, 'copy' | 'native'>; label: string }[] = [
  { channel: 'whatsapp', label: 'WhatsApp' },
  { channel: 'facebook', label: 'Facebook' },
  { channel: 'x', label: 'X' },
  { channel: 'telegram', label: 'Telegram' },
];

const CHANNEL_ICONS = {
  whatsapp: MessageCircle,
  facebook: Facebook,
  x: Twitter,
  telegram: Send,
} as const;

export function ShareSheet({
  open,
  onOpenChange,
  title,
  description,
  message,
  url,
  imageUrl,
  imageName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Full pre-built message (name + price + link). */
  message: string;
  /** Canonical link — each channel gets it ref-tagged on open. */
  url: string;
  imageUrl?: string | null;
  imageName?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrlWithRef(url, 'copy'));
      setCopied(true);
      toast.success('Link copied — paste it anywhere');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed — long-press the link and copy it yourself');
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: message, url: shareUrlWithRef(url, 'native') });
      onOpenChange(false);
    } catch {
      // Dismissed the sheet — not an error worth a toast.
    }
  }

  function openChannel(channel: Exclude<ShareChannel, 'copy' | 'native'>) {
    const target = shareTargetFor(channel, message, shareUrlWithRef(url, channel));
    if (!target) return;
    const opened = window.open(target, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.href = target;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-h3">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button
            type="button"
            onClick={() => openChannel('whatsapp')}
            className="h-12 justify-start gap-3 rounded-md bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
          >
            <MessageCircle aria-hidden className="size-5" /> Share on WhatsApp
          </Button>
          {CHANNELS.filter((entry) => entry.channel !== 'whatsapp').map((entry) => {
            const Icon = CHANNEL_ICONS[entry.channel];
            return (
              <Button
                key={entry.channel}
                type="button"
                variant="outline"
                onClick={() => openChannel(entry.channel)}
                className="h-11 justify-start gap-3 rounded-md font-semibold"
              >
                <Icon aria-hidden className="size-4" /> Share on {entry.label}
              </Button>
            );
          })}
          <Button
            type="button"
            variant="outline"
            onClick={() => void copyLink()}
            className="h-11 justify-start gap-3 rounded-md font-semibold"
          >
            {copied ? (
              <Check aria-hidden className="size-4 text-primary" />
            ) : (
              <Copy aria-hidden className="size-4" />
            )}
            {copied ? 'Copied!' : 'Copy link'}
          </Button>
          {canNativeShare() && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void nativeShare()}
              className="h-11 justify-start gap-3 rounded-md font-semibold"
            >
              <Share2 aria-hidden className="size-4" /> More options…
            </Button>
          )}
          {imageUrl && (
            <Button
              asChild
              variant="outline"
              className="h-11 justify-start gap-3 rounded-md font-semibold"
            >
              <a href={imageUrl} download={imageName ?? 'share.png'}>
                <Download aria-hidden className="size-4" /> Save share image
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
