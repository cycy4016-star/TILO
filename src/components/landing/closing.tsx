// Closing: final CTA band and footer. Slightly tighter spacing, cleaner band.
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Reveal } from '@/components/custom/sample-showcase';
import { TilzaLogo } from '@/components/custom/tilza-logo';
import { Button } from '@/components/ui/button';
import { FOOTER_COLUMNS, LANDING, SOCIALS } from '@/lib/landing-content';
import { siteName } from '@/lib/site';

export function Closing() {
  return (
    <section id="start" aria-label="Get started" className="scroll-mt-20 bg-background">
      <div className="container-page section">
        <Reveal>
          <div className="overflow-hidden rounded-xl bg-[#171717] px-6 py-12 text-center text-white sm:px-10 sm:py-14">
            <p className="text-caption font-bold uppercase tracking-[0.1em] text-[#ffb27a]">
              Your turn
            </p>
            <h2 className="mx-auto mt-3 max-w-2xl break-words text-balance font-display text-h2 sm:text-display">
              Put your shop online today.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-body text-white/70">
              Add your products, share one link, and take orders that arrive priced, itemised and
              ready to confirm.
            </p>
            <div className="mt-7 flex justify-center">
              <Button
                asChild
                size="xl"
                className="bg-highlight font-bold text-highlight-foreground hover:bg-highlight/90"
              >
                <Link href={LANDING.hero.primary.href}>
                  {LANDING.hero.primary.label} <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
            <p className="mt-5 text-caption text-white/60">No card needed.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Rich landing footer; the global slim footer steps aside on the home page. */
export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="container-page section">
        <div className="grid gap-10 md:grid-cols-[1.2fr_repeat(3,1fr)]">
          <div>
            <p className="flex items-center">
              <TilzaLogo className="text-xl" />
            </p>
            <p className="mt-3 max-w-xs text-small text-muted-foreground">
              One link for your products, your prices and your orders — built for growing
              businesses.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {SOCIALS.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${siteName} on ${social.label}`}
                    className="flex min-h-10 min-w-10 items-center justify-center rounded-full border border-border bg-card px-3 text-caption font-medium text-muted-foreground transition-colors hover:text-foreground"
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
              <ul className="mt-3 grid gap-1">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-9 items-center rounded-md text-small text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-9 border-t border-border pt-6 text-caption text-muted-foreground">
          © {new Date().getFullYear()} {siteName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
