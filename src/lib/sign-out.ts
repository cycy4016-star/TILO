'use client';

import { signOut } from '@/lib/auth-client';
import { unsubscribeFromPush } from '@/lib/push-client';

/**
 * Sign out and stop this browser's push subscription first. The server also
 * deletes push rows when the session is revoked (ban, expiry, another tab), but
 * doing it here also closes the browser's PushManager subscription so the next
 * login starts from an honest "off" state instead of a local subscription with
 * no server row behind it.
 *
 * Push cleanup is best-effort: a failure must never trap the user in a session.
 */
export async function signOutAndClearPush(): Promise<void> {
  await unsubscribeFromPush('/api/push/subscribe').catch(() => undefined);
  await signOut();
}
