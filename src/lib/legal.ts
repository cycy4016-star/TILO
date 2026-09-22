// Legal identity for the /privacy and /terms pages. Edit these values to match
// the business publishing this deployment (the single tenant). Dates follow the
// policy version so a reader sees which text is in force today.

export const legalIdentity = {
  /** Legal/business name shown in the policies. */
  businessName: 'Tilo',
  /** Contact email for privacy/compliance questions. */
  businessEmail: 'hello@tilo.app',
  /** Version date of the current policy text. */
  effectiveDate: '22 September 2026',
  /** Regulatory framing — Ghana Data Protection Act, 2012 (Act 843). */
  jurisdiction: 'Ghana',
} as const;
