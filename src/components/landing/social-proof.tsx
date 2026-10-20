// Social proof strip: the free-trial promise, three honest numbers, and the
// channels a shop link travels through. Server-rendered except the counters.
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
    <section aria-label="Social proof" className="border-b border-border bg-card">
      <div className="container-page py-6 sm:py-8">
        <div className="grid items-center gap-6 lg:grid-cols-[1.1fr_1fr]">
          <Reveal>
            <p className="text-h4 font-display">{LANDING.proof.line}</p>
            <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              {PLATFORMS.map(({ label, Icon }) => (
                <li
                  key={label}
                  className="flex items-center gap-1.5 text-caption font-semibold text-muted-foreground"
                >
                  <Icon aria-hidden className="size-4 text-primary" />
                  {label}
                </li>
              ))}
            </ul>
          </Reveal>
          <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card">
            {LANDING.proof.stats.map((stat, index) => (
              <Reveal key={stat.label} delay={index * 80}>
                <div className="px-3 py-4 text-center sm:px-4">
                  <p className="font-display text-h4 font-bold text-primary">
                    <CountUp
                      to={stat.value}
                      suffix={stat.suffix}
                      comma={'comma' in stat && stat.comma}
                    />
                  </p>
                  <p className="mt-1 text-caption leading-tight text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
