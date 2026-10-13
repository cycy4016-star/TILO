// FAQ: accessible accordion. Cleaner rhythm, tighter card. Copy untouched.

import { Reveal } from '@/components/custom/sample-showcase';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FAQS } from '@/lib/landing-content';

export function Faq() {
  return (
    <section id="faq" aria-label="Frequently asked questions" className="scroll-mt-20 bg-muted/40">
      <div className="container-page section">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <p className="text-eyebrow">FAQ</p>
            <h2 className="mt-3 break-words font-display text-h2">Questions, answered</h2>
          </Reveal>
          <Reveal delay={100}>
            <Accordion
              type="single"
              collapsible
              className="mt-7 rounded-2xl border border-border bg-card px-5 py-1 shadow-sm sm:px-6"
            >
              {FAQS.map((faq) => (
                <AccordionItem key={faq.q} value={faq.q}>
                  <AccordionTrigger className="min-h-11 text-left text-body font-medium">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-small text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
