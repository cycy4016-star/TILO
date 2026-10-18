// Every incident explains itself. The ledger already holds the technical truth
// (message, route, stack); this module turns that into the answers a
// non-technical operator actually needs — what this means, and what to do —
// chosen from the failure's fingerprint, never from guesswork about the data.
//
// Pure and client-safe: the HEALTH panel calls it per row, the tests pin its
// wording and its rule order. The order below is part of the contract: a
// database failure that happens to mention an upload must still read as a
// database failure.

export type IncidentGuide = {
  // Short terminal tag for the guide block (DB, SIGN-IN, PHOTOS…).
  area: string;
  // Plain headline: "A change in a shop did not save".
  title: string;
  // One short paragraph: what happened, in human terms.
  what: string;
  // Numbered steps. Always ends with where to look next.
  steps: string[];
};

type IncidentInput = {
  message: string;
  route?: string | null;
  source?: string | null;
};

const GUIDE_DATABASE: IncidentGuide = {
  area: 'DB',
  title: 'The database did not answer',
  what: 'The platform tried to read or save something and the record-keeper of every shop did not reply in time. One-off hiccups pass on their own; a repeating one means the app needs a restart.',
  steps: [
    'Wait a few seconds, then repeat what you were doing.',
    'If it fails again, restart the app: Railway → tilo service → Deployments → ⋮ → Redeploy.',
    'When the redeploy finishes, run the DOCTOR tab (F11) — the database check will confirm it is healthy again.',
  ],
};

const GUIDE_SIGNIN: IncidentGuide = {
  area: 'SIGN-IN',
  title: 'A sign-in step went wrong',
  what: 'Someone could not finish signing in, or their session broke part-way. This is normally a temporary handshake problem — no account or shop data is at risk.',
  steps: [
    'Ask the person to try signing in once more — a single retry clears most of these.',
    'If it repeats, run the DOCTOR tab (F11) and read the “Database” and “Owner account” results.',
    'If Google is the sign-in method, confirm its keys are present: Railway → tilo service → Variables → GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
  ],
};

const GUIDE_PHOTOS: IncidentGuide = {
  area: 'PHOTOS',
  title: 'A photo or logo did not save',
  what: 'A picture was rejected or failed while being stored. The rest of the shop is unaffected — only that one image did not go through.',
  steps: [
    'Try again with the same or a smaller photo — very large camera files are the usual cause.',
    'If it keeps failing, run the DOCTOR tab (F11) and read the “Photo storage” result.',
    'Press COPY REFERENCE below so whoever supports the platform can look up the exact failure.',
  ],
};

const GUIDE_PAYMENTS: IncidentGuide = {
  area: 'PAYMENTS',
  title: 'A payment step failed',
  what: 'A card payment could not start or could not be verified. Money only moves after a successful verification, so there was no double charge.',
  steps: [
    'Ask the customer to try again — or to pay using the shop’s direct payment details instead.',
    'Run the DOCTOR tab (F11) and read the “Payments” result.',
    'If money left an account but the order did not update, press COPY REFERENCE and send it immediately with a DOCTOR report.',
  ],
};

const GUIDE_MESSAGES: IncidentGuide = {
  area: 'MESSAGES',
  title: 'A text message did not send',
  what: 'An SMS or WhatsApp message the platform tried to send did not reach the network. The record of the attempted send is kept.',
  steps: [
    'Resend the message from the shop’s messaging screen.',
    'If it keeps failing, run the DOCTOR tab (F11) and check for open incidents.',
    'Press COPY REFERENCE and send it with a DOCTOR report if this is urgent for a customer.',
  ],
};

const GUIDE_SHOP: IncidentGuide = {
  area: 'SHOP',
  title: 'A change in a shop did not save',
  what: 'A name, price, item or setting someone edited was not written down. Nothing was half-saved — the change simply did not go through.',
  steps: [
    'Open the same editor and save the change again.',
    'If it fails again, run the DOCTOR tab (F11) — a red database or archive result there explains why.',
    'Check the VAULT tab (F10) afterwards: if anything really vanished, it is named there with a restore command.',
  ],
};

const GUIDE_BROWSER: IncidentGuide = {
  area: 'BROWSER',
  title: 'A page in the app hit a snag',
  what: 'Something went wrong inside a visitor’s browser page — often a stale tab or a flaky phone connection. The platform itself kept running.',
  steps: [
    'Reload the page and try again.',
    'If the same screen fails twice, run the DOCTOR tab (F11) to confirm the platform is healthy.',
    'If it keeps happening on one page, press COPY REFERENCE — the route in it names the exact screen.',
  ],
};

const GUIDE_UNKNOWN: IncidentGuide = {
  area: 'UNKNOWN',
  title: 'Something failed that the platform has not met before',
  what: 'The platform caught a failure it cannot yet recognise. It has been written to the incident ledger with everything known about it — nothing was forgotten.',
  steps: [
    'Nothing is lost — the ledger keeps the full trace under this reference.',
    'Press COPY REFERENCE below and send it together with a DOCTOR report.',
    'If the failure began right after a change, the newest VAULT snapshot (F10) holds the state from before it.',
  ],
};

const RULES: { test: (route: string, text: string) => boolean; guide: IncidentGuide }[] = [
  {
    test: (_route, text) =>
      /prisma|p100\d|p1017|p200\d|p2024|p3009|econnrefused|etimedout|timed out|connection (refused|closed)|connection pool|server has closed the connection|database/.test(
        text,
      ),
    guide: GUIDE_DATABASE,
  },
  {
    test: (route, text) =>
      route.includes('/api/auth') || /sign-?in|session|oauth|better-auth/.test(text),
    guide: GUIDE_SIGNIN,
  },
  {
    test: (_route, text) => /upload|image|photo|sharp/.test(text),
    guide: GUIDE_PHOTOS,
  },
  {
    test: (_route, text) => /paystack|payment|charge/.test(text),
    guide: GUIDE_PAYMENTS,
  },
  {
    test: (_route, text) => /\bsms\b|whatsapp/.test(text),
    guide: GUIDE_MESSAGES,
  },
  {
    test: (route) =>
      /^\/api\/(store|catalog|categories|products|items|promotions|orders|feedback)/.test(route),
    guide: GUIDE_SHOP,
  },
];

/**
 * Choose the plain-words guide for one incident. Rules run in the contract
 * order above; a browser-sourced failure gets the browser guide unless it
 * already matched a sharper rule, and anything unrecognised is honest about it.
 */
export function incidentGuide(input: IncidentInput): IncidentGuide {
  const route = (input.route ?? '').toLowerCase();
  const text = `${input.message} ${route}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.test(route, text)) return rule.guide;
  }
  if ((input.source ?? '').toUpperCase() === 'CLIENT') return GUIDE_BROWSER;
  return GUIDE_UNKNOWN;
}
