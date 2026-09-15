# Production-copy migration rehearsal — 2026-09-14

Application baseline: `1addb1118490b3308990edb2994581c8d2837825`.

## Current result

**The authorized database copy was exported, encrypted, restored and rehearsed.**
Both new migrations applied on a second disposable copy. Constraint validation and
eight additional core checks passed. **Production deployment remains NO-GO** because
historical migration files, financial exceptions and real availability remain unresolved.
No source write, payment-provider call or deployed configuration change was performed.

The user supplied the Render service list (wadatrip deployed, wadatrip-db available,
PostgreSQL 17, Oregon) and instructed continuation of the authorized copy. That matches
the sole remote target in local configuration, whose database name is wadatrip_db and
host identifies dpg-d38b19ogjchc73ctf8c0. No credential was requested in chat.
This is service-name/region/version corroboration, not a claim that the user supplied
the exact technical ID. The local Render API still returns HTTP 401, so the current
Gateway DATABASE_URL association was not independently reverified through the API.

## Read-only candidate inspection

The configured candidate was inspected with certificate and hostname verification
(`sslmode=verify-full`), a bounded REPEATABLE READ READ ONLY transaction and metadata
queries only. No customer rows, event payloads or connection credentials were printed.

- Server: PostgreSQL 17.9, Debian 17.9-1.pgdg12+1.
- Time zone: UTC. Encoding: UTF8.
- Reported database size: 9,647,795 bytes (approximately 9.2 MiB).
- Existing public tables include bookings, listing_availability, PaymentRecord,
  PaymentEvent and _prisma_migrations. This says nothing about their column compatibility
  or historical data correctness.
- Only plpgsql was reported as installed extension.
- Current Gateway association: **NOT REVERIFIED VIA API**; the named service and
  candidate metadata match the user's dashboard information and continuation instruction.

The first client connection failed certificate verification because the default system
CA lookup did not work in this Windows setup. The retry used the installed Git CA bundle
and retained verify-full. Verification was not downgraded.

## Isolated destination and actual new evidence

- Dedicated container: wadatrip-p07-rehearsal-20260914.
- PostgreSQL image pinned to
  `postgres@sha256:47f917f7409eacd22fc5dfb1dee634e1b55cf0c01d1a7eb701be2227a03e0641`.
- Confirmed server version: PostgreSQL 17.9, Debian 17.9-1.pgdg12+1.
- Dedicated Docker internal network: wadatrip-p07-internal-20260914.
- PostgreSQL data on tmpfs, no existing data volumes or host directories mounted into DB.
- DB container limited to 512 MiB and one CPU; local password stored in Windows DPAPI
  form in ignored target metadata. No source credentials are passed to this container.
- wadatrip_rehearsal now holds the restored baseline and remains unmigrated/unmodified.
- wadatrip_p07_attempt was created from that baseline for migration and synthetic smoke.

The initial Windows-to-published-port Prisma attempt returned P1001. The internal Docker
network did not expose a usable host connection in this setup. No migration ran on that
attempt. This was retained as evidence instead of opening egress for the DB container.

A disposable Node 20 / Prisma 6.19.1 tool image was prepared before attaching it to the
internal network. Its migration run mounted only the schema file and migrations directory
read-only; no project .env or source data was mounted. The runtime root filesystem was
read-only, with temporary workspace in tmpfs. It accessed PostgreSQL over the internal
network, without external connectivity.

**PASS: all 14 Prisma migrations applied to the separate empty wadatrip_p07_gate DB.**
The migration-history completion count is 14. No db push, migrate resolve or reset was used.
This adds actual PostgreSQL 17.9 fresh-schema evidence to the earlier PostgreSQL 15 suites.
It does not rerun or replace the earlier 227 tests, nor prove historical compatibility.

Ignored local evidence/tooling is under logs/p07-*; no backup, source data, credentials
or raw financial payload belongs in the repository. The tmpfs test data is temporary and
will not survive container destruction. No production recovery claim is based on it.

## Authorized export, encryption and restore

The export used official pg_dump 17.9, verify-full TLS with a trusted CA bundle,
default_transaction_read_only=on, connection/query/lock timeouts and no source DDL/DML.
An ephemeral export tool connected to the source; the restored DB never received source
credentials or external network access. No Stripe or email operation was invoked.

The consistent custom-format archive passed the PGDMP header check, Windows DPAPI
encryption/decryption round trip and digest equality. Plain archive bytes existed only
in process memory/streams. The encrypted archive and any private diagnostics are outside
the repository, under the current user's LocalAppData/Wadatrip/Rehearsals directory,
with inherited ACLs removed and access granted to that user. Retention review: 2026-09-21.
The actual private path is retained only in ignored local operational metadata.

- Archive size: 71,975 bytes.
- Archive SHA-256: f16fec80f58216218a7d8e98757fd0d5746c3ea293d26311bef8f3e405b9846e.
- Export/encryption operation: approximately 7.1 seconds including tool startup.
- Restore: pg_restore 17.9, single transaction, exit-on-error, no source owner/ACL replay.
- Restore result: PASS. This proves this snapshot can be decrypted/restored locally;
  it does not rehearse managed Render disaster recovery or certify Stripe/DB consistency.

The source has data that may be sensitive. Only aggregate counts, technical metadata
and fingerprints were reported. No customer rows, raw events or dump are included in Git.
Ownership/grants on the disposable clone are intentionally local; production role/ACL
compatibility still requires deployment review.

## Baseline counts and real findings

| Table | Original row count |
| --- | ---: |
| users | 28 |
| providers | 21 |
| listings | 25 |
| listing_availability | 0 |
| bookings | 69 |
| PaymentRecord | 1 |
| PaymentEvent | 1 |
| OperatorWallet | 1 |
| itineraries | 0 |

Preflight executed successfully on the restored baseline, not on the source.

- 54 bookings lack expected amount; none is dated today/future in this snapshot.
- One unknown-amount booking has an external payment/session reference. Null therefore
  cannot be treated as proof of no financial risk.
- 22 occupied listing/day combinations have no availability row.
- All 69 original booking dates are past; this does not establish that their lifecycle
  or financial obligations are closed.
- 15 listings are published/approved; all 15 lack availability.
- One legacy paid ledger exists, with a stored cs_test_ checkout reference. This is not
  proof of settlement, live account behavior or complete historical reconciliation.
- One event remains unprocessed; its stored payload does not identify livemode. It was
  not replayed against Stripe or silently marked processed.
- No duplicate external ownership, duplicate availability, orphan PaymentRecord,
  invalid participant count or contradictory booking/ledger references was reported.
- After migration, postflight flags one confirmed/completed booking lacking the ledger
  evidence required by its check. This does NOT establish that a customer was charged:
  the check also flags an uncorroborated confirmation/unknown expected amount.

The zero overcapacity count is not proof of bookability when availability is empty.
The authoritative new flow correctly requires an actual reservable availability row.

## Migration history and actual DDL result

The copied database records 18 completed migrations. The repository contains 12 of
those historical migrations plus the two new migrations. All 12 shared checksums match
(allowing standard LF/CRLF representation). Six applied migrations are absent locally:

1. 20250924194741_add_auth_fields
2. 20250925182141_make_password_optional
3. 20251010021858_add_roles_operator_workflow
4. 20251117201251_add_ai_verification_fields
5. 20251126010631_provider_verification_ocr_fields
6. 20251218182845_init

Search of the corresponding paths in available local Git history did not recover them.
They must be recovered from original deployment/source artifacts with matching checksums,
or handled by an explicitly reviewed baseline strategy. Do not fabricate SQL from names,
edit checksums or mark migrations resolved to silence the diagnostic.

Prisma migrate status exited 1 and reported that exact history divergence.
On the second disposable copy only, migrate deploy exited 0 and applied:

- 20260909000000_restore_schema_history
- 20260910000000_payment_lifecycle

Combined status/deploy orchestration took approximately 4.8 seconds, including container
startup; this is not a precise measure of production DDL lock duration. The copied history
then contained 20 completed migrations and no failed entries. The baseline remained intact.

Important: deploy succeeding does not mean migrate status/history is clean. The negative
rehearsal deliberately preserved this distinction; production remains NO-GO.

## Constraints, postflight and core smoke

All six explicit validation commands passed on the attempt copy:

- booking_participants_positive
- availability_capacity_valid
- booking_external_ids_nonempty
- payment_external_ids_nonempty
- PaymentRecord_booking_id_fkey
- listings_operator_id_fkey (already validated before this explicit check)

The five previously NOT VALID core constraints are now validated in the attempt only.
Final postflight: missing required constraints=0; missing required indexes=0;
unvalidated core constraints=0; event completion mismatch=0; capacity cache mismatch=0.
Catalog inspection also found zero invalid/not-ready indexes on the four core tables.
Historical exceptions remain: unknown inventory=69; unfinished event=1;
confirmation without required ledger evidence=1. No historical data was cleaned.

Eight actual PostgreSQL 17.9 checks passed with compiled common code and Prisma 6.19.1:

1. Every generated Prisma model can read the migrated copy without missing columns.
2. Original columns/rows retain their fingerprints after migration.
3. Two real connections visibly block behind FOR UPDATE; only one buys the last seat.
   The persisted amount stays 12000 usd despite manipulated client fields.
4. Two checkout preparations share one ledger and backend-determined amount.
5. Synthetic success and duplicate event processing produce one consistent confirmation.
6. A thrown transaction rolls back without losing the confirmed state.
7. A free tour consumes capacity and creates no PaymentRecord.
8. The original rows/columns still match the immutable baseline after smoke writes.

These are DB/domain smoke checks, not deployed Gateway/Provider Hub HTTP, public sign-in,
hosted Checkout or notification delivery. No Stripe SDK or external payment call ran.
Payment observations and newly added users/providers/listings are explicitly synthetic.
The first run passed seven checks, then its history comparison incorrectly included
new domain-generated CUID/UUID rows because it excluded only prefixed fixture IDs.
The harness was corrected to compare the immutable baseline ID set, with unchanged
fingerprint equality assertions. The second run passed 8/8. Product code and historical
data were not changed to obtain that result; the failed report/rows were preserved.

Fingerprints cover original columns of all original public tables except Prisma migration
bookkeeping. Hashes are computed in DB; names, emails, tokens and payloads are not returned.
Synthetic rows remain isolated in the attempt DB. The baseline holds the original snapshot.
The prior 227 tests were not rerun or folded into a misleading new total.

## Deliberately blocked DDL migration

A third copy, wadatrip_p07_lock, was created from the unchanged baseline. A separate
connection held ACCESS SHARE on bookings while the exact migration chain was attempted.
Actual PostgreSQL AccessExclusiveLock waiting was observed. Deployment exited 1; original
booking/payment row fingerprints were unchanged. The controlled orchestration took about
9.8 seconds including process startup/observation; the migration's lock_timeout remains 5s.

The harness's initial diagnostic assertion failed because Prisma exposed only the secondary
"current transaction is aborted" error, not "lock timeout". That failure is preserved.
Filtered PostgreSQL server evidence identifies backend PID 912 reporting lock_timeout,
then transaction_aborted. This confirms the expected cause and safe abort independently
of Prisma's incomplete error message. No row data or SQL statement text was printed.
The first time-window log filter returned no matches; the bounded retained-log inspection
found the paired errors. Do not equate a missing wrapper message with absence of a DB error.

The failed migration history/copy was retained, with no automatic migrate resolve/reset.
This demonstrates why deployment recovery must inspect the original database error and
not blindly retry a failed Prisma migration. Managed Render backup/PITR recovery and
actual deployed-role permissions remain untested; local encrypted restore and domain
transaction rollback passed.

## Next steps and release decision

1. Recover/review the six historical migration files and repeat history validation.
2. Investigate the unprocessed event, unknown-amount external reference and uncorroborated
   confirmation using technical associations. Decide explicit historical disposition;
   never infer zero payment risk, replay blindly or rewrite source rows automatically.
3. Obtain one real operator's approved availability, capacity, policy and settlement facts.
   Zero availability means the current listings are not ready for the new booking flow.
4. Rehearse the final maintenance/migration sequence with deployed-role permissions,
   public frontend/API and notification/settlement smoke; retain the proven lock-timeout
   diagnostic procedure and test managed backup recovery.
5. No commit, push, deploy, source migration or Stripe Live activation is authorized by
   this result. The three pre-existing protected files remain byte-for-byte unchanged.

PRODUCTION COPY CREATED: YES
PRODUCTION MIGRATION REHEARSED: YES (DDL applied on isolated copy; release gates failed)
POSTGRES 17.9 FRESH MIGRATIONS: PASS (14/14)
COPY CORE SMOKE: PASS (8/8)
HISTORICAL MIGRATION CONTRACT: FAIL (six missing source migrations)
PRODUCTION DEPLOYMENT GO: NO
SOURCE SERVICE CORROBORATED: YES (user dashboard); GATEWAY API ASSOCIATION REVERIFIED: NO
PRODUCTION WRITES: NONE
STRIPE LIVE READY: NO
