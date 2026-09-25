// Shared layout shell for the static legal pages (/privacy, /terms).
// Reads its copy as props so each page owns its wording. Pages set their own
// `export const metadata` for SEO.

import { CheckCircle2 } from 'lucide-react';

export interface LegalSection {
  /** Section heading (rendered as `##` in h2 form). */
  heading: string;
  body: string[];
}

export interface LegalPageProps {
  title: string;
  description: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

export function LegalPage({ title, description, updated, intro, sections }: LegalPageProps) {
  return (
    <main className="bg-background text-foreground">
      <section className="border-b border-border bg-muted/40 px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            {description}
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{title}</h1>
          <p className="mt-4 text-sm uppercase tracking-widest text-muted-foreground">
            Last updated {updated}
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <p className="text-lg leading-relaxed text-muted-foreground">{intro}</p>
        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <article key={section.heading}>
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <CheckCircle2 className="size-5 text-primary" aria-hidden />
                {section.heading}
              </h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-3 leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
