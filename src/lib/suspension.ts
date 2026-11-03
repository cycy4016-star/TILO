// Shared suspension test. Better Auth's admin plugin sets `banned` and an
// optional `banExpires`; an expired temporary ban is treated as active again,
// mirroring the plugin's own session-creation check. Pure (no server imports) so
// both the auth gate and background jobs can use it.
export type SuspensionFields = {
  banned?: boolean | null;
  banExpires?: Date | string | null;
};

/** True while a ban is in force. Missing/empty `banExpires` means permanent. */
export function isSuspensionActive(user: SuspensionFields): boolean {
  if (!user.banned) return false;
  if (!user.banExpires) return true;
  const until =
    user.banExpires instanceof Date
      ? user.banExpires.getTime()
      : new Date(user.banExpires).getTime();
  return !Number.isFinite(until) || until > Date.now();
}
