// Closing: final gradient CTA band (keeps id="start" for existing nav/menu
// anchors) followed by a rich footer with link columns and socials. The slim
// global SiteFooter still renders below with privacy/terms.
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Reveal } from '@/components/custom/sample-showcase';
import { TiloMark } from '@/components/custom/tilo-mark';
import { Button } from '@/components/ui/button';
import { FOOTER_COLUMNS, LANDING, SOCIALS } from '@/lib/landing-content';
import { siteName } from '@/lib/site';

export function Closing() {
  return (
    <section id="start" aria-label="Get started" className="scroll-mt-20 bg-background">
      <div className="container-page section">
        <Reveal>
          <div className="overflow-hidden rounded-3xl bg-foreground px-6 py-14 text-center text-background shadow-2xl sm:px-12">
            <p className="text-eyebrow text-primary">Your turn</p>
            <h2 className="mx-auto mt-4 max-w-2xl break-words text-balance font-display text-3xl leading-tight sm:text-display">
              Put your shop up this afternoon.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-body-lg text-background/70">
              Add your products, share one link, and take orders that arrive already priced,
              itemised and totalled.
            </p>
            <div className="mt-8 flex justify-center">
              <Button
                asChild
                className="h-12 rounded-md px-8 font-semibold text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30"
              >
                <Link href={LANDING.hero.primary.href}>
                  {LANDING.hero.primary.label} <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-caption text-background/60">No card needed.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Rich site footer — a labelled region (the slim global footer keeps the contentinfo landmark). */
export function LandingFooter() {
  return (
    <section aria-label="Site footer" className="border-t border-border bg-muted/40">
      <div className="container-page section">
        <div className="grid gap-10 md:grid-cols-[1.2fr_repeat(3,1fr)]">
          <div>
            <p className="flex items-center gap-2">
              <TiloMark className="size-8 rounded-xl" iconClassName="size-4" />
              <span className="font-display text-base font-semibold tracking-tight">
                {siteName}
              </span>
            </p>
            <p className="mt-3 max-w-xs text-small text-muted-foreground">
              A shareable shop page for your products — made for growing African businesses.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {SOCIALS.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${siteName} on ${social.label}`}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-card px-3 text-caption font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="text-caption font-semibold uppercase tracking-widest text-muted-foreground">
                {column.heading}
              </p>
              <ul className="mt-4 grid gap-1">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-11 items-center rounded-md text-small text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-10 border-t border-border pt-6 text-caption text-muted-foreground">
          © {new Date().getFullYear()} {siteName}. All rights reserved.
        </p>
      </div>
    </section>
  );
}
