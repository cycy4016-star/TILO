// Social proof strip: platform presence, animated counters and one editable
// testimonial. Server-rendered; only the numbers are a client island.
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
          <p className="text-center text-eyebrow">{LANDING.proof.line}</p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
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
        <div className="mx-auto mt-10 grid max-w-3xl gap-6 text-center sm:grid-cols-3">
          {LANDING.proof.stats.map((stat, index) => (
            <Reveal key={stat.label} delay={index * 90}>
              <p className="font-display text-h2">
                <CountUp
                  to={stat.value}
                  suffix={stat.suffix}
                  comma={'comma' in stat && stat.comma}
                />
              </p>
              <p className="mt-1 text-caption uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </p>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <figure className="mx-auto mt-10 max-w-xl rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <blockquote className="text-body text-foreground">
              “{LANDING.proof.testimonial.quote}”
            </blockquote>
            <figcaption className="mt-3 text-caption text-muted-foreground">
              {LANDING.proof.testimonial.name}
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
