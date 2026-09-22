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
    <main className="bg-[#fffbeb] text-stone-900 dark:bg-stone-950 dark:text-amber-50">
      <section className="bg-amber-950 px-5 py-16 text-amber-50 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">
            {description}
          </p>
          <h1 className="mt-3 font-display text-4xl font-black uppercase leading-none sm:text-6xl">
            {title}
          </h1>
          <p className="mt-4 text-sm font-bold uppercase tracking-widest text-amber-200">
            Last updated {updated}
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <p className="text-lg font-medium leading-relaxed text-stone-600 dark:text-stone-300">
          {intro}
        </p>
        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <article key={section.heading}>
              <h2 className="flex items-center gap-2 font-display text-xl font-black uppercase tracking-tight">
                <CheckCircle2 className="size-5 text-yellow-600" aria-hidden />
                {section.heading}
              </h2>
              {section.body.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-3 font-medium leading-relaxed text-stone-600 dark:text-stone-300"
                >
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
