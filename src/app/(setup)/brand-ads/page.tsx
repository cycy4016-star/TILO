// /brand-ads — the company's own ad campaign as a press kit: every creative,
// the caption to post with it, and a plain statement of what happens when a
// merchant taps a channel. The artwork is rendered by /api/brand-ads/[variant]
// (next/og); the copy lives in src/lib/brand-ads.ts and is the same copy the
// repo generator renders into scripts/ads/template.html.
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BRAND_AD_POSTING_FLOW, BRAND_AD_TRUTH, BRAND_ADS } from '@/lib/brand-ads';

export const metadata: Metadata = {
  title: 'Brand ads & press kit',
  description:
    'Tilza’s own ad campaign: the creatives, the captions, and exactly what happens when a merchant posts them.',
  robots: { index: false, follow: true },
};

export default function BrandAdsPage() {
  return (
    <main className="bg-background text-foreground">
      <section className="container-page section">
        <p className="text-eyebrow">Press kit</p>
        <h1 className="mt-3 max-w-3xl break-words text-balance font-display text-h2">
          The ads Tilza runs on itself
        </h1>
        <p className="mt-4 max-w-[62ch] text-body text-muted-foreground">
          Every product in a Tilza shop gets a ready-to-post ad: the image and the caption are
          written for you, then handed to the channel you pick. These are the creatives we run on
          Tilza itself — download them, paste the caption, post.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="xl">
            <Link href="/signup">Start free for 30 days</Link>
          </Button>
          <Button asChild variant="outline" size="xl">
            <Link href="/dashboard/ads">Open Ad Studio</Link>
          </Button>
        </div>
      </section>

      <section className="bg-card" aria-label="Creatives">
        <div className="container-page section grid gap-8 md:grid-cols-2">
          {BRAND_ADS.map((ad) => (
            <article
              key={ad.key}
              className="flex flex-col gap-4 rounded-lg border border-border p-5"
            >
              <Image
                src={`/api/brand-ads/${ad.key}`}
                alt={ad.label}
                width={ad.width}
                height={ad.height}
                unoptimized
                className="w-full rounded-md border border-border"
              />
              <div>
                <h2 className="text-body font-semibold">{ad.label}</h2>
                <p className="mt-1 text-small text-muted-foreground">
                  {ad.width} × {ad.height} · {ad.format === 'story' ? 'Story' : 'Feed square'}
                </p>
              </div>
              <div className="rounded-md border border-border bg-background p-4">
                <p className="text-eyebrow">Caption</p>
                <p className="mt-2 text-small leading-relaxed">{ad.caption}</p>
                <p className="mt-2 text-small text-muted-foreground">{ad.hashtags.join(' ')}</p>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-3">
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/brand-ads/${ad.key}`} download={ad.fileName}>
                    Download PNG
                  </a>
                </Button>
                <p className="text-caption text-muted-foreground">
                  Channels: {ad.channels.join(', ')}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container-page section" aria-label="How posting works">
        <p className="text-eyebrow">How posting works</p>
        <h2 className="mt-3 max-w-2xl break-words text-balance font-display text-h2">
          One tap, then you decide
        </h2>
        <p className="mt-4 max-w-[62ch] text-body text-muted-foreground">{BRAND_AD_TRUTH}</p>
        <dl className="mt-8 grid gap-4 md:grid-cols-3">
          {BRAND_AD_POSTING_FLOW.map((row) => (
            <div key={row.channel} className="rounded-lg border border-border bg-card p-5">
              <dt className="text-small font-semibold">{row.channel}</dt>
              <dd className="mt-2 text-small leading-relaxed text-muted-foreground">{row.what}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
