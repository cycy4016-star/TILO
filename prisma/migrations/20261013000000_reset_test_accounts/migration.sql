-- One-time reset of the test accounts created while TILO was being deployed.
--
-- Why this exists: the platform-admin role is stamped ONCE, at account
-- creation, by matching the verified phone against ADMIN_PHONE (see
-- resolveRole in src/lib/auth.ts). The test signup already happened before
-- ADMIN_PHONE was configured, so those rows are stuck at role = "user" and
-- cannot be re-created — the phone is unique. Clearing them lets the operator
-- sign up fresh and receive the role at creation.
--
-- `user` cascades to every shop-owned row (session, account, store, catalogue,
-- customer, order, notification, feedback), so a single delete removes the
-- whole workspace. `verification` and `SmsUsage` carry no foreign key and are
-- cleared explicitly: the former holds the OTP attempt cap that would
-- otherwise block a re-signup, the latter is the SMS billing ledger for the
-- throwaway OTP sends.
--
-- Safe on a fresh database — every statement affects zero rows there.

DELETE FROM "verification";

DELETE FROM "SmsUsage";

DELETE FROM "user";
