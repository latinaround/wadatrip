# SEC-1 — local authentication remediation

Baseline: `7d00c3df4939a3e8d5447463c3e138de6d216a0c`. This change does not enable
Operator Beta, payments, publication, invitations, Community or new AI/mobile work.
It does not implement session revocation or move browser tokens to cookies.

## Security behavior

- Trips and push registration use the shared database-backed active-user guard.
  Existing ownership filters and native request/response fields remain intact.
- OTP issuance and verification acquire the same per-address PostgreSQL transaction
  advisory lock. Issuance retires all earlier unused challenges; verification reads
  the latest challenge including consumed/expired records, with no historical fallback.
- OTP hashes use domain-separated HMAC-SHA256 bound to challenge ID and canonical email.
  The key is `AUTH_CODE_HASH_SECRET` when provided, otherwise `AUTH_RATE_LIMIT_SECRET`;
  it must contain at least 32 characters and remain stable across instances.
  There is deliberately no SHA256-only legacy fallback. Previously issued codes must
  be requested again after a future coordinated rollout.
- A correct challenge is consumed in the same transaction as user creation/update and
  token signing. Concurrent requests issue at most one credential. Wrong attempts commit
  their counters; inactive accounts receive no credential or successful-login timestamp.
  Database or signing failures roll back consumption. Failed email sends retain a used
  latest challenge rather than deleting it and potentially reviving older records.
- Persistent request budgets commit before password hashing, code verification or
  federated verification. Google/Firebase share their pre-proof budget. Successful
  attempts count too; sign-in success and process restarts cannot reset quotas.
  Database uncertainty fails closed with 503; exhausted quotas return 429 with
  `retry_after_seconds` and HTTP `Retry-After`.
- Canonical email uses NFC, trim and lowercase. Password inputs are bounded at 4096
  characters, identity proofs at 8192 and submitted names at 120. Existing password
  verification semantics and `{token,user}` responses are preserved. Password login
  remains email-unverified; OTP/Google/Firebase remain email-verified.

## Configuration and database dependencies

No schema migration. Requires the existing full migration chain, especially
`20260602093000_add_auth_login_codes` and the existing `auth_request_limits` migration.
The Community schema/history is untouched. Existing request-code HMAC bucket purpose,
scopes, quotas, proxy parsing and cleanup semantics are preserved.

| Operation | Account budget | Client budget | Global/hour | Global/day |
|---|---:|---:|---:|---:|
| request-code (unchanged) | 1/60 seconds; 6/hour | 30/hour | 300 | 2000 |
| login | 10/15 minutes | 30/15 minutes | 300 | 2000 |
| register | 3/hour | 5/hour | 50 | 250 |
| verify-code | 30/10 minutes; also 5/challenge | 30/10 minutes | 600 | 3000 |
| google + firebase combined | none before verified identity | 30/15 minutes | 300 | 2000 |

New optional overrides: `AUTH_{LOGIN,REGISTER,VERIFY,FEDERATED}_LIMIT_IP`,
`AUTH_{LOGIN,REGISTER,VERIFY}_LIMIT_ACCOUNT`, and
`AUTH_{LOGIN,REGISTER,VERIFY,FEDERATED}_LIMIT_GLOBAL_{HOUR,DAY}`.
Zero, negative, noninteger or over-cap values fail closed. Defaults require no new
environment variables when the existing strong rate-limit secret is configured.
OTP TTL accepts 1–30 minutes, maximum attempts 1–5; defaults remain 10 and 5.
Do not rotate rate/hash keys casually: that resets bucket identity/invalidates codes.

Keep `AUTH_TRUSTED_PROXY_HOPS` at the independently verified deployment value.
Do not enable blanket Express proxy trust. Local tests cover the existing right-edge
depth-two Render algorithm, including spoofed left prefixes and an untrusted socket
peer. These tests do not replace live ingress verification during a future release.

## Compatible dependency fixes

Root Yarn resolutions enforce all nested Gateway/server consumers:
body-parser 1.20.9, engine.io 6.6.10, socket.io-parser 4.2.7, ws 8.21.0,
proxy-addr 2.0.8, qs 6.16.1. Parser dependencies also update side-channel 1.1.1,
side-channel-list 1.0.1 and add @types/ws 8.18.2. raw-body resolves only to 2.5.3.
NestJS/Express/Socket.IO majors, browser dependencies and mobile code are unchanged.
Do not apply an automatic framework-major audit fix.

Maintainer sources:
[body-parser](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828),
[Engine.IO](https://github.com/socketio/socket.io/security/advisories/GHSA-r635-g3xr-vw7x),
[Socket.IO parser](https://github.com/socketio/socket.io/security/advisories/GHSA-2m8v-j782-fhvr).

## Required local acceptance

Build common/db/provider-hub/operator-leads/Gateway and web with Node 24.22.1 and
the pinned Yarn lockfile. Generate Prisma only against an explicit synthetic config.
Run existing security, MFA, beta gates, financial/transactional regressions plus:

```text
node scripts/sec1-dependencies.test.cjs
node scripts/sec1-socket-contract.test.cjs
node scripts/sec1-auth.postgres.test.mjs
node scripts/auth-rate-limit.postgres.test.mjs
node scripts/postgres-concurrency.test.mjs
node scripts/postgres-booking-http.test.mjs
node scripts/operator-booking-inbox.postgres.test.cjs
```

PostgreSQL tests require the existing guarded, disposable, loopback-only test cluster
and its private target file. They create new databases, never reuse or drop a database,
and never load production dotenv or send mail/payment requests. Identity providers are
stubbed in auth contract tests; real provider authentication remains a later acceptance.
Additional browser tests exercise preserved onboarding, checkout and session UI behavior.

## Future rollout and rollback (not authorized by this task)

1. Review the candidate manifest and freeze the candidate hash. Keep both operator
   allowlists empty, preparation-only true, payments/new live false and uploads closed.
2. With separate deployment approval, verify the full existing migration history and
   backup/isolated restore procedure. SEC-1 adds no production migration or database reset.
3. Confirm a stable >=32-character OTP key, identical across all replicas, and the
   established proxy depth. Never put keys, backups or real account data in Git.
4. Avoid mixed old/new auth writers during cutover: stop/drain the old version before
   accepting new OTP traffic. Old SHA-only codes are intentionally rejected. Ask test
   users to request fresh codes; only use a separately confirmed owner test email.
5. Repeat HTTPS/CORS, actual email sign-in, MFA, inactive-account, private ownership,
   closed-publication/booking/payment and multi-instance quota smoke checks.
6. If rollback is required, retain the closed beta gates, drain the new release and
   select the exact prior artifact/commit. No down migration or data restore is needed
   for this additive behavior-only patch. Old code cannot verify HMAC challenges, so
   request fresh codes. Rolling back reintroduces SEC-1 vulnerabilities and requires
   explicit risk/containment review; do not reopen beta on the vulnerable release.

## Next gate: SEC-2

Add a PostgreSQL-backed session registry with hashed opaque web credentials / registered
native token IDs, absolute/idle expiry, logout and account-wide revocation. Check it in
HTTP guards, admin proof binding and private WebSocket delivery. Add a migration and
race/revocation/expiry tests before coordinating the browser cookie/CSRF cutover.
Browser localStorage and logout's lack of server revocation remain unresolved here.
External Operator Beta must stay closed until those required session controls and the
remaining agreed launch gates pass acceptance. SEC-1 alone is not beta-launch approval.
