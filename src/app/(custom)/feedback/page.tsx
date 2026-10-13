// /feedback — the public inbox. Anyone (shopper, owner, or a signed-out
// stranger) can tell Tilo what is broken or what they think, and the note lands
// in the admin Feedback panel. Storefronts deep-link here as
// /feedback?shop=<slug> so the report is filed against the right shop.

import type { Metadata } from 'next';
import { FeedbackForm } from '@/components/custom/feedback-form';

export const metadata: Metadata = {
  title: 'Feedback',
  description: 'Tell us what is broken, what you love, or what we should build next.',
  robots: { index: true },
};

export default function FeedbackPage() {
  return (
    <main className="bg-background text-foreground">
      <section className="border-b border-border bg-muted/40 px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-eyebrow">Tell us</p>
          <h1 className="mt-3 font-display text-h1">Feedback</h1>
          <p className="mt-4 max-w-[65ch] text-body leading-relaxed text-muted-foreground">
            Something crashed, something confused you, or something just works well — say so here.
            Every note is read by a person on the Tilo team.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <FeedbackForm />
      </section>
    </main>
  );
}
