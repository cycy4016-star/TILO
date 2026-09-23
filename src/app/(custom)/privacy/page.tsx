// /privacy — how a Tilo deployment handles the personal data flowing through it.
// Text is honest to what the app actually does (see FEATURES.md §8-9, §14).
// Edit the identity/copy to match your business before going live.

import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/custom/legal-page';
import { legalIdentity } from '@/lib/legal';

export const metadata: Metadata = { title: 'Privacy Policy', robots: { index: true } };

const { businessName, businessEmail, effectiveDate, jurisdiction } = legalIdentity;

const sections: LegalSection[] = [
  {
    heading: 'What we collect',
    body: [
      `Account details you give us on sign-up: your name, phone number, and (optionally) email. Phone numbers are verified with a one-time SMS code.`,
      `The business data you run on ${businessName}: customers, orders, amounts, automation rules, store details, and catalogue items you create. Store logos, item photos, and profile avatars are stored with your account.`,
      `Storefront visitor data left on your public store: name, phone, town, and any note, collected only when a visitor ticks the opt-in box. Submissions are saved to your customers list.`,
      `An SMS usage ledger records every message ${businessName} sends on your behalf — recipient, source (verification code, automation, brief, manual), segment count, and delivery result.`,
      `Payment data is handled by Paystack (recipient, amount, reference, status); ${businessName} stores the transaction reference and outcome needed to settle an order.`,
    ],
  },
  {
    heading: 'What we use it for',
    body: [
      `To operate your workspace: authenticate you, keep your customers and orders in sync, run your automation rules, send SMS (verification codes, nudges, briefs), and process online payments.`,
      `To keep your storefront working: saved visitors show up in your customers list, and public catalogue images are served to shoppers.`,
      `${businessName} does not sell personal data and does not use it for advertising on third-party platforms. Automation and brief text messages go only where your own rules and settings direct them.`,
    ],
  },
  {
    heading: 'Who we share it with',
    body: [
      `SMS is delivered by our provider, BMS, which receives recipient numbers and message text to send them.`,
      `Online card payments are processed by Paystack, which receives the payment details and returns the outcome.`,
      `The data belongs to your business, not to ${businessName}; we act as the processor operating your workspace.`,
    ],
  },
  {
    heading: 'How long we keep it',
    body: [
      `We keep your workspace data for as long as your account is active. When you delete a customer, order, rule, or photo it is removed from the database.`,
      `If you want your account and its data removed entirely, email ${businessEmail} and we will delete what we hold, subject to any retention required by law.`,
    ],
  },
  {
    heading: 'How we protect it',
    body: [
      `All traffic is served over HTTPS, connections to the database are encrypted, and secrets (SMS, payment, and auth keys) live only in server environment variables, never in code or repositories.`,
      `Access to the workspace is authenticated per user; the owner can assign admin status, and every data route checks that a signed-in user is calling it.`,
    ],
  },
  {
    heading: 'Your rights',
    body: [
      `You can access, correct, or export the data in your workspace at any time from the dashboard. You can ask us to correct or delete personal data by emailing ${businessEmail}.`,
      `Storefront visitors gave consent to be contacted; they can ask the business to remove their details, and we will honour that request through the workspace.`,
    ],
  },
  {
    heading: 'Contact',
    body: [
      `Questions about this policy or your data? Email ${businessEmail}.`,
      `This policy is governed by the laws of ${jurisdiction}.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="How your data is handled"
      updated={effectiveDate}
      intro={`${businessName} runs your chat-led business workspace. This policy explains what personal data flows through the platform, what we do with it, and the control you keep over it.`}
      sections={sections}
    />
  );
}
