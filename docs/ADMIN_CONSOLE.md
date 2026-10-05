# Administrative access and account records

## Business source of truth

Wadatrip account records live in PostgreSQL `users`. A verified email sign-in
proves control of the mailbox, not legal identity or operator suitability.
Travelers and provider owners use the existing AuthContext and primary JWT.
The console uses that same identity; it does not create a separate Firebase
administrator session, trust a browser whitelist, or permit self-promotion.

Backend eligibility requires an active account, a verified email claim matching
the current database email, and either the database admin role or an explicit
server-side admin allowlist. Never grant privileges from a registration role,
request body, UI link, or frontend environment variable.

The exact owner account must be identified and verified before any role grant.
This change does not change existing roles or production configuration.

## Routes and least disclosure

- `/admin/users`: paginated accounts, name/email, database role/status, registration
  and login timestamps, booking/request counts, linked provider status. Search
  accepts name, email, or technical user ID. Email is private admin data.
- `/admin/date-requests`: tour, technical user ID, requested/offered dates,
  participant count and request state. An inquiry never implies a sale.
- `/admin/payment-issues`: bookings requiring cancellation/reconciliation/refund
  review and confirmed bookings with unknown or insufficient local backing.
  Unknown historical amounts remain unknown. These are read-only investigation
  summaries, not a complete financial ledger or refund interface. Unresolved or
  orphan processor events still require the existing technical investigation.
- `/admin/audit`: technical administrator, action, result, optional resource ID
  and timestamp. No query terms, request bodies, OTPs or tokens are stored.

These API reads always require the second-factor proof and return `no-store`.
Explicit selects omit password hashes, Firebase identifiers, documents, raw
payment payloads, client secrets and private processor objects. Existing provider,
listing and booking tools remain behind the same console/session guards.

## Second factor

An eligible administrator enrolls a time-based authenticator using a fresh
primary sign-in (at most ten minutes old). Enrollment lasts fifteen minutes and
resumes the same seed until expiration; it cannot reset failed attempts.

The server creates a random 20-byte TOTP seed. AES-256-GCM encrypts it with
per-user authenticated data and a random nonce. `ADMIN_MFA_ENCRYPTION_KEY`
must be a base64-encoded, randomly generated 32-byte key held in the backend
secret manager. Never put it in Vercel, `VITE_*`, source control, logs or tickets.
Do not regenerate it on startup or rotate it without an explicit recovery plan.

Six-digit SHA-1 codes use thirty-second counters and a one-step clock tolerance.
Consumed counters are persisted; a code cannot create two proofs, even on two
database connections. Five failures lock verification for fifteen minutes.
Failed attempts commit before the HTTP rejection. Enrollment and verification
serialize on the existing user's `FOR NO KEY UPDATE` lock inside a transaction.
No email or external processor call occurs inside these transactions.

Successful verification returns a fifteen-minute JWT proof with a dedicated
purpose/audience, user and credential version. Its session hash binds it to the
primary Bearer JWT. Primary sign-ins carry a random `jti`, so two sign-ins in the
same second are distinct. The proof is only accepted as `X-Admin-Proof`; it cannot
replace primary authentication. The UI holds it in memory, clears it at logout,
session change or expiry, and discards responses from a previous user session.
Refreshing the browser requires another authenticator code. The shared primary
JWT keeps the current AuthContext storage behavior; this change adds no token
storage scheme.

## Safe rollout

1. Identify the owner's exact existing account. If a separate business mailbox
   is desired, register and verify it normally first. Do not infer an admin
   identity from a similar address or overwrite a linked guide profile.
2. Review the additive `20261005000000_admin_console` migration. Rehearse on an
   authorized isolated clone of the current schema/history before production.
   Record migration history and counts of `users`, providers and bookings before
   and after. Verify they are unchanged; the two new tables start empty.
3. Take an authorized backup. Apply the migration as an explicit operation, not
   as a build/startup side effect. The SQL is atomic with a three-second lock
   timeout and fifteen-second statement timeout. If a timeout occurs, stop and
   investigate; do not remove the limits or run an automatic repair.
4. Deploy common, DB, Gateway and Provider Hub together, then the frontend.
   Keep `ENABLE_ADMIN_CONSOLE` disabled until schema/code/key are ready. Build,
   start and Prisma generate do not apply this migration; tests explicitly apply
   it only to a guarded disposable database.
5. Set `ADMIN_MFA_ENCRYPTION_KEY` privately in the Gateway. Enable the console.
   Assign only the verified, specifically approved administrator account using
   a reviewed, guarded, reversible operation. It must not be an API/UI endpoint.
   If that mailbox has no account yet, an exact server-side `ADMIN_EMAILS` entry
   can prepare eligibility without inventing a user or a verified login. The
   owner must complete normal email verification before enrollment/access.
   A later database role grant is separate; allowlist users enter through
   `/admin/login` because the public header's Admin shortcut uses the database role.
6. Enroll the authenticator through the existing email-code sign-in. Verify the
   console's read views and audit trail. Do not copy the enrollment seed into
   screenshots or support records.
7. Enable `ADMIN_REQUIRE_MFA=true` on **every service using common security**,
   including Provider Hub if deployed separately. Forward the original Bearer
   and `X-Admin-Proof` through existing internal authenticated requests. Never
   rely on only the frontend guard or set the flag on just one service.
8. Smoke-test anonymous/non-admin denial, eligible admin without proof denial,
   MFA success, role revocation, session switching, expiry and logout; also
   verify traveler booking and provider ownership still work without admin MFA.
   The Admin link is a convenience for a database admin role, not authorization.

The enforcement flag defaults off for a compatible rollout of existing routes.
**Do not consider rollout complete until it is enabled on all relevant services.**
New console reads require MFA regardless of that compatibility flag.
Console feature flags must be literal `true` to enable them.

## Audit and recovery limits

New console reads and MFA changes commit their audit records atomically. Existing
Gateway administrator operations also log technical outcomes through an
interceptor. These legacy action logs are best effort: audit failure is logged
without undoing a business operation that already committed. Provider Hub does
not independently add an action log, so direct internal calls are not covered
by the Gateway interceptor. This is not a tamper-proof financial audit ledger.

There is deliberately no self-service reset, disable-MFA or grant-admin API.
If a device is lost, independently verify the owner's identity, revoke the old
credential/proofs, retain an investigation record, then authorize a guarded
re-enrollment. Preserve the encryption key in approved secret storage/backups;
losing it requires recovery, not bypassing the factor. Do not replace the key to
silently invalidate all administrators. Retention/export and broader financial
recovery tooling are separate work.

## Validation

Local tests cover real Nest HTTP authorization with synthetic data, TOTP reference
vectors, authenticated encryption/tampering, replay and throttling, proof expiry
and session binding, safe selects, client session changes and a local browser.
Disposable PostgreSQL tests exercise actual row locks with two connections,
foreign keys, uniqueness, audit rollback, persisted failures, and migration over
a populated historical synthetic schema without altering accounts.

No test enrolls a production user, sends a real email, contacts Stripe, or grants
production privileges. A real owner sign-in/enrollment remains a deployment
acceptance step; local browser API mocks are not evidence of production access.
