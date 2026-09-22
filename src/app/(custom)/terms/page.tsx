// /terms — the terms on which Tilo is provided. Plain-language, honest, and
// edited to the business actually operating this deployment.

import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/custom/legal-page';
import { legalIdentity } from '@/lib/legal';

export const metadata: Metadata = { title: 'Terms of Service', robots: { index: true } };

const { businessName, businessEmail, effectiveDate } = legalIdentity;

const sections: LegalSection[] = [
  {
    heading: 'The service',
    body: [
      `${businessName} is a business operations workspace: customers, linked orders, follow-up automations, SMS, an optional storefront, and online payments — all under one signed-in account.`,
      `The service is provided "as is" for your business operations. You run your own automation rules and messages; the workspace delivers whatever you configure.`,
    ],
  },
  {
    heading: 'Your account',
    body: [
      `Accounts are phone-first and verified with a one-time SMS code. You are responsible for keeping your sign-in credentials secure and for what happens under your account.`,
      `The first user matching the owner contact configured for this deployment is granted admin, which controls access to workspace settings.`,
    ],
  },
  {
    heading: 'Your content and conduct',
    body: [
      `You own the content you put in your workspace (customers, orders, catalogue, messages). You are responsible for it: keep it accurate, and only use numbers with people who expect to be contacted.`,
      `Don't use the platform to send spam or misleading messages, to run unlawful business, or to interfere with other people's data. ${businessName} may suspend accounts that misuse the service.`,
    ],
  },
  {
    heading: 'SMS and delivery',
    body: [
      `SMS is billed to your ${businessName} usage and delivered through our provider, Arkesel. Credit costs and sender IDs are shown in the dashboard's SMS usage card.`,
      `Deliveries depend on the phone networks and the recipient's device; ${businessName} confirms sends and failures in the usage ledger but cannot guarantee delivery.`,
    ],
  },
  {
    heading: 'Payments',
    body: [
      `Online checkout is processed by Paystack. By offering checkout you agree to honour accepted orders and refunds in line with your own shop policy.`,
      `The platform itself is not metered or gated; those are order payments for goods or services you sell.`,
    ],
  },
  {
    heading: 'Availability and liability',
    body: [
      `We aim to keep the workspace available, but you accept that no service is faultless. ${businessName} is not liable for indirect or consequential loss (for example, lost sales or missed messages) arising from use of the service.`,
      `Nothing in these terms removes rights you cannot waive under applicable law.`,
    ],
  },
  {
    heading: 'Contact',
    body: [
      `Questions about these terms? Email ${businessEmail}.`,
      `These terms were last updated on ${effectiveDate}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="The rules of the road"
      updated={effectiveDate}
      intro={`These terms govern your use of the ${businessName} workspace. By signing up and using the service you accept them.`}
      sections={sections}
    />
  );
}
