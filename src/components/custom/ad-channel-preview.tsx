// How the ad will actually look once it lands: a WhatsApp chat bubble and a
// Facebook feed post, rendered as compact fixed-colour mockups (the social
// apps keep their own look in either theme). Both use the same published
// artwork the owner will attach, so what they see is what gets posted.
'use client';

import { CheckCheck, Globe, MessageCircle, Share2, ThumbsUp } from 'lucide-react';
import { useState } from 'react';

type Channel = 'whatsapp' | 'facebook';

const TABS: { key: Channel; label: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'facebook', label: 'Facebook' },
];

export function AdChannelPreview({
  storeName,
  storeSlug,
  caption,
  imageUrl,
  imageAspect,
  itemName,
  url,
}: {
  storeName: string;
  storeSlug: string;
  /** Full caption exactly as it will be pasted. */
  caption: string;
  /** Published artwork (with the drawn-in CTA). */
  imageUrl: string;
  /** CSS aspect-ratio for the artwork, e.g. "1080 / 1080". */
  imageAspect: string;
  /** Title shown on the Facebook link card. */
  itemName: string;
  /** Absolute store/item URL — the Facebook link card's domain comes from it. */
  url: string;
}) {
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  let domain = 'tilza.org';
  try {
    domain = new URL(url).host;
  } catch {
    // Keep the fallback domain.
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-semibold text-muted-foreground">How it will look</span>
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setChannel(tab.key)}
              aria-pressed={channel === tab.key}
              className={`rounded-md border px-2.5 py-1 text-caption font-semibold transition-colors ${
                channel === tab.key
                  ? 'border-primary bg-primary/10 text-highlight-ink'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="overflow-hidden rounded-lg border border-border"
        style={{ background: channel === 'whatsapp' ? '#efeae2' : '#f0f2f5' }}
      >
        {channel === 'whatsapp' ? (
          <div className="grid gap-1.5 p-3">
            <div className="ml-auto w-[86%] max-w-80 rounded-lg rounded-tr-none bg-[#d9fdd3] p-1 shadow-sm">
              {/* biome-ignore lint/performance/noImgElement: dynamic next/og image. */}
              <img
                src={imageUrl}
                alt=""
                className="w-full rounded-md object-cover"
                style={{ aspectRatio: imageAspect }}
              />
              <p className="line-clamp-5 px-1.5 py-1 text-[11px] leading-snug whitespace-pre-wrap text-[#111b21]">
                {caption}
              </p>
              <div className="flex items-center justify-end gap-1 px-1.5 pb-0.5">
                <span className="text-[10px] text-[#667781]">{time}</span>
                <CheckCheck aria-hidden className="size-3.5 text-[#53bdeb]" />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white">
            <div className="flex items-center gap-2 px-3 pt-3">
              <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1877f2] text-xs font-bold text-white">
                {storeName.charAt(0).toUpperCase()}
                {/* biome-ignore lint/performance/noImgElement: dynamic public logo route. */}
                <img
                  src={`/api/public/store/${storeSlug}/logo`}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold text-[#050505]">
                  {storeName}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-[#65676b]">
                  Sponsored · <Globe aria-hidden className="size-2.5" />
                </span>
              </span>
            </div>
            <p className="line-clamp-4 px-3 py-2 text-[11px] leading-snug whitespace-pre-wrap text-[#050505]">
              {caption}
            </p>
            {/* biome-ignore lint/performance/noImgElement: dynamic next/og image. */}
            <img
              src={imageUrl}
              alt=""
              className="w-full object-cover"
              style={{ aspectRatio: imageAspect }}
            />
            <div className="flex items-center bg-[#f0f2f5] px-3 py-2">
              <span className="min-w-0">
                <span className="block text-[9px] tracking-wide text-[#65676b] uppercase">
                  {domain}
                </span>
                <span className="block truncate text-[12px] font-semibold text-[#050505]">
                  {itemName}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-around border-t border-[#ced0d4] py-1.5 text-[10px] font-medium text-[#65676b]">
              <span className="inline-flex items-center gap-1">
                <ThumbsUp aria-hidden className="size-3.5" /> Like
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle aria-hidden className="size-3.5" /> Comment
              </span>
              <span className="inline-flex items-center gap-1">
                <Share2 aria-hidden className="size-3.5" /> Share
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
