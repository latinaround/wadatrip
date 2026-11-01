# SEC-2: mandatory server-side sessions

This is the local successor to the verified SEC-1 candidate. It does not deploy,
open Operator Beta, enable publication/bookings/payments, or implement SEC-3 cookies,
CSRF and CSP. There is no signature-only compatibility switch.

## Authority and credentials

`libs/common/src/sessions.ts` is the shared authority. A protected request needs an
HS256 JWT **and** a matching credential hash, session ID, generation, account epoch,
unexpired registry row and active database user. Identity, role and email assurance
come from the current database records. Missing/unknown/revoked credentials return
401; database/configuration failures return 503, with no signature-only fallback.
The indexed authorization SQL also checks revocation while updating last-seen state.
Already-authorized business transactions are not retroactively cancelled by logout.

JWTs retain the native `{token,user}` contract and canonical `sub`, email and role
fields. New claims are `sid`, `sg`, `ue` and a random 256-bit `jti`. The registry stores
only SHA-256 of the high-entropy credential, never the credential, password, OTP, IP
or identity-provider token. A non-secret `session` response includes ID, generation,
kind and expiration. Password sessions remain email-unverified; verified OTP/IdP
sessions retain their distinct assurance. Old JWTs are intentionally not backfilled
or accepted: the future cutover requires fresh sign-in, including from SecureStore.

## Registry and policies

Migration: `20261030000000_auth_sessions`, additive, 29 -> 30 migrations.

- `users.auth_epoch`, default zero; nullable `reauth_after`.
- `auth_sessions`: ID, web/native kind, nullable pre-login owner, unique credential/flow
  hashes, generation, account epoch, method, verified-email/primary-authentication
  timestamps, creation/last-seen/expiry, revocation timestamp and bounded reason.
- Restrict user deletion, validate state/hash/time/kind constraints and index owner/expiry.
- Database triggers prevent decreasing generation/epoch/cutoff or clearing revocation.
  Account disablement and email/password changes advance epoch/recovery cutoff;
  re-enabling an account does not revive its old sessions.
- Existing 29 migration files and business/Community/MFA records are unchanged.
  DDL is transactional with a three-second lock timeout and 30-second statement timeout.

| Policy | Default | Accepted configuration |
|---|---|---|
| Native absolute lifetime | 7 days | `JWT_TTL_SECONDS`, 60–604800 |
| Browser absolute lifetime | 8 hours | `AUTH_SESSION_WEB_TTL_SECONDS`, 60–28800 |
| Browser idle lifetime | 30 minutes | `AUTH_SESSION_WEB_IDLE_SECONDS`, 60–3600 |
| Recent primary proof for enrollment/logout-all | 10 minutes | Fixed |
| MFA step-up proof | Existing 15 minutes | Preserved |

Expiration uses PostgreSQL time in authorization. GET/HEAD, bootstrap and socket
validation/emissions do not extend browser idle time. Authenticated mutations and
application socket input may count as activity; nothing extends absolute expiry.
Background polling cannot refresh primary-authentication freshness or MFA proof.
Expired rows do not require a cleanup worker to be rejected. Retention/cleanup is a
separate policy decision; do not purge revocation state during a release rollback.

## Browser transitions before SEC-3

The web app still uses its existing Bearer/localStorage transport. It adds a
server-backed flow protocol to close login/logout races before the cookie cutover:

1. `POST /auth/flow` from an exact trusted Origin creates an expiring pre-login row
   and returns a random flow secret plus generation zero, held only in memory.
2. Credential issuance carries `X-Wada-Auth-Flow` and `X-Wada-Auth-Generation`.
   Under locks, the server verifies the expected generation, rotates the credential
   and increments generation. A flow secret alone never authorizes private data.
3. `POST /auth/logout` revokes the exact credential and/or flow. It can cancel a
   generation-zero login whose credential response has not arrived. A stale generation
   cannot revoke a later account switch. Revoked flows cannot be logged into again.
4. The client validates a newly returned credential using `/auth/me` before publishing
   the account; local operation revisions reject stale responses. Cross-tab storage
   changes invalidate local transitions; restored pages recheck server authority.
5. Local sign-out invalidates private state immediately. Failed/uncertain server
   logout retains an in-memory retry context, visibly reports unconfirmed sign-out,
   and blocks another sign-in until acknowledged. A 2xx response without `ok:true`
   is not confirmation. No authentication tokens are put into URLs or broadcasts.

Both new headers are included in Gateway CORS. The existing trusted-origin function
is reused; no wildcard origins or domain/deployment changes were made. Pre-login
flow creation has separate persistent client/global budgets. All SEC-1 budgets and
the verified trusted-proxy algorithm remain. No cookies are authenticated here,
so flow/Bearer secrets are explicit request credentials rather than ambient cookies.

## Logout, recovery and MFA

`POST /auth/logout` is idempotent for a registered credential. Possession of its exact
high-entropy value can revoke that row even after expiry or a signing-key rotation;
it cannot authorize data access. This prevents a later key rollback reviving a token
whose logout happened during rotation.

`POST /auth/logout-all` requires active, recently verified primary authentication.
It increments account epoch, sets recovery cutoff, revokes all active sessions and
retires pending OTPs in one transaction. Password-only, stale or unknown-primary-time
IdP sessions cannot perform it. OTP recovery must use a newly issued challenge.
Google/Firebase proofs after a recovery cutoff must establish sufficiently recent
`auth_time`; missing/old values require fresh OTP. Revoking Wadatrip sessions does
not revoke an identity provider's refresh credentials.

MFA proofs bind to the registered session ID, generation and account epoch plus
the existing MFA credential version. A raw/empty Authorization hash is not identity.
Enrollment rechecks recent primary proof under its transaction lock. Existing encrypted
seeds, failure lockout, replay counters, audits and in-memory frontend proof storage
are preserved. Lost MFA still requires documented owner-controlled recovery with a
credential-version increment and global revocation, not a public email-only bypass.

## WebSockets and internal services

The registered EventsGateway checks exact browser origins (also for WebSocket upgrades),
the active registry session at connection and each input/private emission. Invalid
sessions receive no private event and are disconnected. Quiet connections are checked
every 15 seconds without extending idle time; physical disconnect may therefore lag,
but private-event/input authorization always rechecks immediately. Database failures
close delivery. Gateway-to-Hub forwarding retains the existing internal token and
registered Bearer credential; recipients recheck the same database authority.

## Mobile companion

Original project: `C:\Projects\wadatrip-mobile`, preserved unchanged. The isolated
companion under `logs/sec2-local-20261029/mobile-source` adds:

- `/auth/me` validation before accepting an email/Firebase sign-in response.
- Confirmed server logout of the captured native token, immediate local invalidation,
  visible retry on uncertainty and stale-response/account-switch protections.
- Existing SecureStore format/options, device-storage revision guards and native
  seven-day cap remain. No SDK, dependency, Android/iOS project or storage migration.
- Expo Web uses the same browser flow client; its copy is hash-checked against the
  main web helper. Native API paths/bodies remain compatible and require no flow handle.

Old installed binaries do not acquire server-logout behavior automatically; shipping
the companion is a separately approved app release. They can still use newly issued
registered native JWTs, and server revocation/disablement is enforced on all API use.
They must sign in again after strict cutover. Local module/contract tests are not an
EAS build, signed release, real SecureStore device or real IdP acceptance.

## Future rollout — separate approval required

1. Freeze exact platform/mobile manifests, hashes and build artifacts. Keep both
   operator allowlists empty; preparation-only true; new/live money false; publication,
   document uploads, Community/AI proxies and Provider Hub beta flags closed.
2. Confirm protected backup, isolated restore and current full migration checksums.
   Do not put database URLs, secrets or backups in Git. No production backup was
   requested or created by this local SEC-2 task.
3. Review the new TTL policy and existing JWT/MFA/OTP keys. No key rotation or new
   service is required. Ensure every recipient/service is upgraded to the same strict
   common guard; never run a signature-only old replica beside the cutover.
4. During an approved maintenance window, drain auth writers/old replicas. Apply the
   additive migration explicitly, independently of the build. A lock-timeout failure
   rolls back its DDL; inspect migration status before any retry. Never automatically
   mark a failed migration applied.
5. Deploy only reviewed SEC-2 artifacts. The beta startup check rejects missing session
   tables, epoch/cutoff columns, monotonic triggers, migration record or unfinished
   migrations. Deploy the coordinated web flow client; no stale frontend fallback.
6. Rehearse actual owner email sign-in, IdP, MFA, SecureStore, HTTP/WS revocation, expiry,
   tenant isolation and closed commerce gates. Synthetic tests do not replace this.
   Release admission remains closed while SEC-3 and remaining launch gates are pending.
7. Distribute a compatible mobile build only after its separately approved build/device
   acceptance. Require fresh login; do not exchange old JWTs into registered sessions.

## Rollback safety floor

**SEC-1 and older signature-only binaries are not safe rollback targets after SEC-2
has accepted traffic.** Such a binary ignores revocation even if the additive table
is retained. The rollback floor is a validated SEC-2-aware backend/web/mobile artifact.
Preserve the migration, rows, generations, user epochs, cutoff timestamps and MFA
versions. No down migration, table truncation, generation reset, reactivation or
signature-only feature flag is provided.

For a bad subsequent release: close admission/new money, drain writers and select
the exact prior SEC-2-aware artifact. Keep the current auth database, keys and
monotonic state. Repeat token-replay and MFA-generation smoke checks before traffic.
For a failed **initial** cutover without a good SEC-2 artifact to fall back to, keep
private/auth traffic in maintenance or suspend it; do not reopen on SEC-1.

Never restore a pre-revocation backup over a serving auth database. If disaster
recovery requires restoring an older backup, keep ingress closed and, under separate
approval, advance all user epochs/cutoffs, revoke every restored active session/flow
and pending OTP, review MFA recovery and keys, then prove old credentials fail before
reopening. This is a recovery procedure, not ordinary application rollback.

## Acceptance evidence and remaining gate

The local report/manifest list exact tests, files, migration/history checks and hashes.
Coverage includes cross-pool revocation, logout replay, disable/re-enable, concurrent
generation reuse, delayed responses, account switching, key rollback, MFA binding,
HTTP/WS failures, historical business/MFA/Community preservation and transactional
booking/payment regressions. A three-second migration lock failure is exercised on
a disposable 29-migration database before a successful 30-migration upgrade.

SEC-3 remains mandatory before external Operator Beta: HttpOnly/Secure/SameSite
cookies with CSRF, coordinated browser/native transport rules, verified same-site
domain/TLS/CORS and browser security hardening. localStorage/XSS exposure and the
remaining SEC-1 dependency triage are not solved by server revocation. SEC-3 is not
started by this change.

Design references: [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[PostgreSQL 17 locking](https://www.postgresql.org/docs/17/explicit-locking.html).
