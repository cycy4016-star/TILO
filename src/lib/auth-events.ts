// Permanent auth-activity ledger writer.
//
// The admin dashboard's "sign-ins" and "last seen" stats used to be derived
// from Session rows — which better-auth DELETES on sign-out, on ban/revoke and
// on expiry, so a user's activity history vanished the moment they logged out
// or came back days later. Every sign-up and every sign-in now ALSO appends one
// immutable AuthEvent row (see prisma/schema/auth.prisma), keyed to the user's
// unique id, and the dashboard reads history from there instead.
//
// Append-only by contract: nothing in the app updates or deletes these rows.
// Re-signing in writes a NEW row, so logging out and back in can never
// overwrite, duplicate or erase earlier history.
//
// Never throws — same rule as captureAdminAlert: a failed ledger write must not
// block the sign-in / sign-up that caused it.
import 'server-only';

import type { AuthEventKind } from '@prisma/client';
import { prisma } from '@/lib/db';

export type AuthEventInput = {
  userId: string;
  kind: AuthEventKind;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function recordAuthEvent(input: AuthEventInput): Promise<void> {
  try {
    await prisma.authEvent.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        ipAddress: input.ipAddress ?? null,
        // Request headers are attacker-controlled input; keep the ledger tidy
        // (and the UI unbroken) by clipping to a sane length.
        userAgent: input.userAgent?.slice(0, 300) ?? null,
      },
    });
  } catch {
    // Same rule as the alert stream: losing a ledger line is acceptable,
    // failing the sign-in it describes is not. The next sign-in re-attempts.
  }
}
