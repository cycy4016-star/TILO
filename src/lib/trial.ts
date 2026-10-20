// Free-trial policy. Every account gets the full toolkit for TRIAL_DAYS after
// sign-up; this module is the single source of truth for the length and for
// turning a stored `trialEndsAt` into something a page can render. It is
// CLIENT-SAFE (no server-only imports) so both the auth hook (server) and the
// dashboard banner (client) import the same numbers.

/** Length of the free trial, in days. Used at account creation and in copy. */
export const TRIAL_DAYS = 30;

/** When a trial started at `from` ends. */
export function trialEndsAtFrom(from: Date, days: number = TRIAL_DAYS): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export type TrialState = {
  /** The resolved end date, or null when the account has no trial window. */
  endsAt: Date | null;
  /** Whole days remaining (0 once the trial has ended). */
  daysLeft: number;
  /** True while now() is before endsAt. */
  active: boolean;
  /** True once now() is at or past endsAt. */
  expired: boolean;
};

/**
 * Resolve a stored `trialEndsAt` (Date from the DB, ISO string from the wire,
 * or null) into a render-ready state. A missing date counts as an ended trial
 * rather than an eternal free ride — the safe default.
 */
export function trialState(
  trialEndsAt: Date | string | null | undefined,
  now: Date = new Date(),
): TrialState {
  if (!trialEndsAt) {
    return { endsAt: null, daysLeft: 0, active: false, expired: true };
  }
  const endsAt = trialEndsAt instanceof Date ? trialEndsAt : new Date(trialEndsAt);
  if (Number.isNaN(endsAt.getTime())) {
    return { endsAt: null, daysLeft: 0, active: false, expired: true };
  }
  const msLeft = endsAt.getTime() - now.getTime();
  const active = msLeft > 0;
  return {
    endsAt,
    daysLeft: active ? Math.ceil(msLeft / (24 * 60 * 60 * 1000)) : 0,
    active,
    expired: !active,
  };
}
