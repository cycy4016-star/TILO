// Social proof strip: platform presence, animated counters and one editable
// testimonial. Server-rendered; only the numbers are a client island. Tighter spacing.
import { Facebook, Instagram, MessageCircle, Music2, Twitter } from 'lucide-react';
import { Reveal } from '@/components/custom/sample-showcase';
import { CountUp } from '@/components/landing/motion';
import { LANDING } from '@/lib/landing-content';

const PLATFORMS = [
  { label: 'Instagram', Icon: Instagram },
  { label: 'TikTok', Icon: Music2 },
  { label: 'WhatsApp', Icon: MessageCircle },
  { label: 'Facebook', Icon: Facebook },
  { label: 'X', Icon: Twitter },
];

export function SocialProof() {
  return (
    <section aria-label="Social proof" className="border-y border-border bg-muted/40">
      <div className="container-page section">
        <Reveal>
          <p className="mx-auto max-w-[46ch] text-balance text-center text-body-lg text-muted-foreground">
            {LANDING.proof.line}
          </p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2.5">
            {PLATFORMS.map(({ label, Icon }) => (
              <li
                key={label}
                className="flex items-center gap-2 text-small font-medium text-muted-foreground"
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </li>
            ))}
          </ul>
        </Reveal>
        <div className="mx-auto mt-9 grid max-w-3xl gap-6 text-center sm:grid-cols-3">
          {LANDING.proof.stats.map((stat, index) => (
            <Reveal key={stat.label} delay={index * 90}>
              <p className="font-display text-h2">
                <CountUp
                  to={stat.value}
                  suffix={stat.suffix}
                  comma={'comma' in stat && stat.comma}
                />
              </p>
              <p className="mt-1 text-eyebrow">{stat.label}</p>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <div className="mx-auto mt-9 max-w-xl rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-body font-medium text-foreground">
              Every new shop gets 14 days free — shelves, themes, promos and analytics.
            </p>
            <p className="mt-1.5 text-small text-muted-foreground">
              No card to start. Pick a plan only when the trial ends.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
