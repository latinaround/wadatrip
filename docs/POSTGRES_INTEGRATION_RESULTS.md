# P0 #5 — actual PostgreSQL evidence

Date: 2026-09-13. Application commit: 02ca58d723925c9cde036af63f751878ac82a608.
Updated 2026-09-14. Result: **P0 #5 CORE GATES PASS; HOSTED STRIPE TEST PAYMENT PASS.**
The original failures below are retained as evidence. The duplicate-webhook acceptance
assertions remain unchanged; a real PostgreSQL table-lock barrier now makes the initial
insertion race deterministic instead of relying on timing.

## Closure after authorization to fix the blocker

- Reproduced P2002 again on real PostgreSQL before the fix. Three additional unit cases
  failed before correction: first-insert collision, collision with an already-processed
  event, and completion between read and conditional processing update.
- receivePaymentEvent now handles only Prisma P2002 with model PaymentEvent and the
  single unique target id, then reloads the durable row. All unrelated or ambiguous
  errors propagate. This is outside the financial transaction; it does not catch an
  error inside an aborted transaction or overwrite a winning event's payload.
- A conditional update affecting zero rows returns false; a concurrently completed
  event is not reported as newly processing. The financial event/listing locks and
  processed_at completion contract are unchanged.
- Existing regression 184/184; receipt error cases 8/8; real PostgreSQL core 20/20;
  historical migration cases 7/7; HTTP/SDK-loopback integration 8/8: **227/227 PASS**.
- Real HTTP evidence now includes the traveler helper, Nest controllers, JWT, independent
  Gateway/Provider Hub Prisma pools, canonical checkout amount, valid/unsigned webhooks,
  duplicate delivery, free tour, operator cancellation and last-seat contention.
- A real SDK transport outage is sustained through its retries. The HTTP retry reuses
  the persisted idempotency key/parameters and one simulator session. The first attempt
  at fault injection dropped only one response, which the SDK recovered itself; that
  was a harness assumption, not a product failure.
- A disposable PostgreSQL trigger terminates its own connection during external-session
  attachment, after SDK response. The application returns an error; booking/payment
  writes roll back, inventory stays held, and the next HTTP request reattaches the same
  external session with the same ledger and idempotency identity. Trigger removed after
  injection; no application SQL or production schema contains this test mechanism.

The HTTP simulator is not Stripe Test. A separate, explicitly invoked script,
scripts/stripe-test-e2e.mjs, was prepared for hosted Stripe Test with a headless isolated
Chrome profile, real SDK and CLI-forwarded signed events. Test-key authentication was
verified (livemode false) and the Test webhook-endpoint list was empty before any test
transaction. This script rejects live/unknown keys and configured webhook destinations,
uses synthetic customer data and a disposable DB, and never loads production DB config.
Its own result must be read separately; 227 local tests do not claim a hosted payment.

## Hosted Stripe Test result — 2026-09-14

Independent run `mu1gscwx` finished PASS at 16:35:52 UTC. Evidence is in ignored
`logs/p06-stripe-test-mu1gscwx.json`; no credentials or Checkout access URL is in this report.

- Actual travelerBooking helper -> real local Nest booking/checkout routes -> disposable
  PostgreSQL -> actual hosted Stripe Checkout in isolated Chrome -> Stripe CLI signed
  webhook delivery -> confirmed booking. No Prisma or processor mock in this run.
- Canonical listing price USD 120; injected client price 1 / EUR cannot change the total.
  Stripe Test Checkout reports amount_total 12000, currency usd, livemode false.
- Actual payment_intent.succeeded and checkout.session.completed events processed.
  Booking confirmed; ledger succeeded; inventory held, remaining capacity 1 of 2.
- Two locally signed replays of the actual event return success and retain one ledger.
- The earlier hosted attempt did not complete because the optional Link save-details
  checkbox requested a phone number. The runner now opts out of Link enrollment.
  That incomplete Test session was expired; its real expiration event cancelled the
  booking and released capacity. No product code or Stripe configuration was changed.
- No money was charged in live mode. This is a successful test transaction, not the first
  paid customer reservation. Stripe Test records are retained as evidence.

Test card and CLI authentication reference: [Stripe test cards](https://docs.stripe.com/testing)
and [Stripe CLI environment authentication](https://github.com/stripe/stripe-cli/wiki/using-stripe-api-keys).
Playwright Core 1.63.0 was installed only under ignored logs/p06-browser; product
package.json and Yarn state were not changed. The CLI used an isolated ignored config;
its signing secret and API key were never printed. Owned browser and listener were closed.

Scope limits: JWT is synthetic but signed/verified through the existing mechanism against
a seeded synthetic user. This did not test public sign-in/email delivery, the deployed
TourDetail DOM, deployed success-page rendering, Stripe Connect onboarding/payouts,
declines/3DS on hosted Checkout, live processing or production migration history.

## Remaining gates for a real customer reservation

1. Close the authorized, exact 13-file commit after staged review. No staging/commit is
   performed by the test runners. Keep the three protected pre-existing changes excluded.
2. Rehearse migration on an explicitly authorized copy representing the actual DB;
   review preflight/postflight counts and validate retained constraints after evidence-based
   cleanup. Synthetic migration success does not establish production-data compatibility.
3. Prepare and approve coordinated backend migration/deployment, then verify the public
   frontend/API connection, CORS and return URLs. AppConfig currently defaults to
   api.wadatrip.com unless VITE_API_BASE_URL overrides it; no deployed/DNS state is inferred
   from this local value. DNS, Render and Vercel were not modified.
4. Load only operator-approved real availability/capacity for the first listing, and
   verify traveler sign-in, operator visibility and notification behavior end to end.
   The core intentionally rejects dates without canonical availability; never invent slots.
5. Verify the existing Connect/payment settlement arrangement and manual review/refund
   procedure for the first operator. Obtain separate approval for live credentials and
   deployment before collecting real money. This run created no Connect integration.

Within existing authorization, the core defect and reproducible local/Test payment flow
are completed. These remaining production gates are not claimed as done.

## Authorized repair and current evidence

- Added `20260909000000_restore_schema_history`, ordered before payment lifecycle.
  No existing migration checksum was edited. Missing declarations had been stranded
  outside Prisma migration directories. Recovery covers the existing Prisma contract,
  including fields read through user/provider/listing relations. Restoring declarations
  for itinerary fields, verification fields, covers and wallet does not enable those features.
- Existing tables are checked for required columns, exact storage types, primary keys
  and named index definitions; incompatible structures abort the transaction. Nullable
  historical financial values remain unknown. No amounts, external IDs or payment rows
  are manufactured. Adding booking currency leaves existing rows NULL and sets a default
  only for future writes. Existing lifecycle migration retains its NOT VALID strategy.
- Missing role/status columns use the existing traveler/active auth defaults; no admin
  privileges are assigned. A production copy still requires review of actual auth history.
- A separate real defect was found in both report scripts: `date::date day` is rejected
  by PostgreSQL. Only that alias and its references were corrected to `AS booking_day`.
  Original committed versions still reproduce the syntax error against PostgreSQL;
  corrected versions execute in READ ONLY transactions and print counts only.
- Fresh chain: all 14 migrations apply. Original failed database is retained. Negative
  historical cases intentionally fail DDL and prove rollback, rather than fixing records.
- Historical suite: preservation of null amounts, paid/succeeded, orphan ledgers, blank
  IDs, unfinished events, invalid participants and excess occupancy; duplicate external
  ownership/days and incompatible schema/index definitions block migration as expected.
- Before correction, the real concurrency suite found `P2002` on `PaymentEvent.id` during
  simultaneous initial receipt: one caller succeeded and one failed. The corrected run
  accepts both callers. Already-received event processing also passes under its row lock.

The first repair runner attempt also exposed a harness error: environment sanitization
removed P05_DATABASE, causing Prisma to consult the retained failed test DB and return
P3009. No migration was applied there. The runner now requires an explicit allowed DB
and passes it after sanitization; there is no fallback to the retained evidence DB.

## Original blocker: simultaneous first receipt (now fixed)

`libs/common/src/payment-events.ts`, receivePaymentEvent(), uses Prisma upsert with an
empty update. With this Prisma version the observed concurrent first insertion can
raise P2002, target PaymentEvent.id, before the financial processing transaction/catch.
That finding blocked the original run; the narrowly scoped recovery above now handles it.

Reproduced repeatedly with two independent Prisma clients on PostgreSQL 15.14. Test
`concurrent duplicate webhook: durable event and one final financial state` requires
both calls to succeed; it now passes with the deterministic insertion barrier. The test
does not add a retry or replace the actual upsert. Original technical evidence remains in
ignored logs/p05-duplicate-*.json. No double ledger or over-allocation was observed.

Implemented correction: narrowly handle the id-unique collision then reload. The catch
does not handle association, other unique constraints, connection failures or deadlocks.
The unchanged success assertions and full lifecycle regression pass.

## Environment and isolation

- Real PostgreSQL 15.14, Debian, in dedicated container wadatrip-p05-20260912.
- Image pinned to postgres@sha256:bc51cf4f1fe02cce7ed2370b20128a9b00b4eb804573a77d2a0d877aaa9c82b1.
- Host 127.0.0.1, exclusive port 55435; database wadatrip_p05_fresh.
- Exclusive test role/password, random database marker verified before migration.
- PostgreSQL data stored on tmpfs; no existing project volumes mounted.
- Node 24.11.1 and Prisma Client 6.19.1. No claims of production runtime parity.
- The PostgreSQL-only suites use no production connection, real customer data, Stripe
  API, mock DB or simulated locks. The separate hosted run contacts Stripe Test explicitly.
- Docker Desktop was started. Existing project PostgreSQL/Redis containers also resumed;
  they were not used or queried. The dedicated test container remains running for inspection.

Generated target credentials and raw evidence are in ignored logs/, never intended for Git:
 p05-target.json, p05-postgres.env, p05-migration-result.json.
The report contains technical/schema evidence only; the runner redacts its password/URL.

## Original failed test (before repair)

The runner verified current_database(), current_user, a database-specific marker and an
empty public schema before executing the original Prisma migrate deploy chain.
It did not call db push, resolve migrations, run the standalone SQL or load project .env.

12 migration directories completed:
20250827233319_init through 20260806093000_add_firebase_identity_and_push_devices.

The 13th migration, 20260910000000_payment_lifecycle, failed. Container PostgreSQL logs:

    ERROR: relation "PaymentRecord" does not exist
    ERROR: current transaction is aborted, commands ignored until end of transaction block

Prisma reported the second error. Server logs exposed the underlying missing relation.
The migration's initial LOCK TABLE statement references PaymentRecord and PaymentEvent,
which the applied migration chain never created.

The failed _prisma_migrations entry has finished_at absent, applied_steps_count 0,
and rolled_back_at absent. The last field does not prove SQL effects persisted: it is
Prisma migration bookkeeping, not a transaction rollback report.

Read-only catalog inspection confirmed:

- PaymentRecord absent.
- PaymentEvent absent.
- Bookings contains only id, listing_id, provider_id, user_id, status, date, num_people,
  total_price, payment_status, created_at and trip_id.
- Thus its expected amount_cents, currency, external-reference and other financial
  columns are also absent from the reconstructed pre-P0 database.
- inventory_state and the checked lifecycle indexes are absent; no successful P0 DDL
  was observed.

Definitions for the missing financial structures exist in
libs/db/prisma/migrations/add_itinerary_pricing_fields.sql, a standalone file outside
Prisma migration directories. It was not executed by the 13-migration run.
This is an incomplete migration-history contract, not proof of a booking-lock defect.

## Required test matrix

| Requirement | Actual status |
| --- | --- |
| 1. Prisma migrations from scratch | Original FAIL; repaired chain PASS |
| 2. Migration over historical synthetic dataset | PASS, including expected rejection/rollback cases |
| 3. Lifecycle foreign keys | PASS; new orphan write rejected |
| 4. Lifecycle UNIQUE constraints | PASS; same-day slot and external-reference collisions rejected |
| 5. NOT VALID constraints | PASS; old suspect rows retained, new writes enforced; validation fails on an orphan |
| 6. Lifecycle indexes | PASS, catalog inspection |
| 7. payment-preflight.sql behavior | Original syntax FAIL; corrected read-only report PASS |
| 8. payment-postflight.sql behavior | Original syntax FAIL; corrected read-only report PASS |
| 9. Actual application SELECT FOR UPDATE protocol | PASS; blocked sessions observed with pg_blocking_pids |
| 10. Last seat, two connections | PASS, one success and one 409 |
| 11. Two Gateway-like transactions | PASS, independent Prisma pools calling compiled shared core |
| 12. Gateway + Provider Hub protocol | PASS at shared domain boundary and two real Nest HTTP applications with independent pools |
| 13. Booking/payment transaction rollback | PASS, both writes undone |
| 14. Deadlock/transient failure behavior | PASS detection of deliberately inverted order; no automatic retry claimed |
| 15. Concurrent duplicate payment event | Original FAIL P2002; corrected first receipt and already-received processing PASS |
| 16. PaymentEvent retry after failure | PASS, same event reaches processed with two attempts |
| 17. Two simultaneous checkout preparations | PASS, one ledger/idempotency identity; alternative flow rejected |
| 18. Cancellation racing success | PASS, succeeded money + refund review, no false final confirmation |
| 19. Late payment success | PASS, past tour date alone does not reject settlement |
| 20. Connection loss at transaction boundaries | PASS at tested boundaries: pre-commit termination, post-commit disconnect, DB termination after external response before attachment |

The requested historical scenarios are synthetic and isolated in separate databases.
No dependent result relies on a mocked database or simulated lock.

## Limits that remain gates

- The P0 #5 suites never call Stripe. Their SDK HTTP simulator is loopback-only. The
  separate P0 #6 script explicitly contacts Stripe Test; results are reported separately.
- Two Nest HTTP applications exercise actual Gateway and Provider Hub controllers with
  independent pools in one Node process. This is not a deployed multi-host benchmark or
  a test of every feature in each application's full production module.
- The intentionally reversed two-listing lock test establishes PostgreSQL deadlock
  detection/rollback (SQLSTATE 40P01), not a deadlock in the normal one-listing protocol.
  Automatic transient retry is not implemented. Contention beyond transaction timeout
  remains an operational retry condition.
- Killing a known test session before commit and reconnecting is tested. Ambiguous
  loss of the COMMIT acknowledgment is not injected. DB loss immediately after the
  SDK's simulator response is injected with pg_terminate_backend and recovery verified.
  The latter is not an outage of Stripe infrastructure or proof about a live payment.
- No real historical dataset was inspected. The migration fails closed on incompatibility;
  passing synthetic data is not authorization to migrate production. Inspect the actual
  copy, preflight counts, defaults/constraints and resolve data conflicts explicitly first.
- NOT VALID constraints deliberately remain unvalidated; no historical rows are silently
  cleaned. Existing unrelated schema drift (for example draft versus pending listing
  default in old migrations) is not a claim of total schema parity.

## Reproduction and next action

Run node scripts/postgres-integration.mjs only with P05_DATABASE explicitly set to a newly
provisioned matching disposable target. The Prisma config and runner read logs/p05-target.json,
containing host, port, database, user, password and marker. The initial proof run used
an equivalent ignored config at logs/p05-prisma.config.ts; the tracked copy preserves
the same schema/migration path and database target.

The migration runner refuses a nonempty public schema, so a repeat requires a fresh disposable DB,
not erasing or marking the failed migration resolved in this evidence DB. Its database
marker must be provisioned through the named test container, not inferred from a URL.
Never point the runner at a project database or import the root Prisma config.

The integration test files provision unique databases using the existing dedicated
container and verified marker/role. They preserve every failed database. Use:

    node --test --test-isolation=none scripts/postgres-history.test.mjs
    node --test --test-isolation=none scripts/postgres-concurrency.test.mjs

Both commands now pass; retained reports document the original failing runs.
Docker/local-engine access is required. Build common before running the compiled-core
tests. Never import root prisma.config.ts: the explicit test config does not load dotenv.
Only the dedicated test harness invokes migrate deploy; build, validate, generate and
local startup defaults have not been changed to apply migrations automatically.

Regression: 184/184 existing lifecycle, capacity, price, traveler auth, security and
migration-contract tests passed. Common, DB, Gateway, Provider Hub and frontend builds
passed; Prisma validate/generate passed using the explicit disposable configuration.
Frontend has the existing bundle-size warning. Protected pre-existing files are preserved.

Previous totals were 210 PASS / 1 FAIL. After correction and expanded integration,
**227 PASS / 0 FAIL**, excluding migration-gate CLI and hosted Stripe Test executions.
No acceptance test was skipped to achieve this result.

## Exact working-tree scope

New files:

- docs/POSTGRES_INTEGRATION_RESULTS.md
- libs/db/prisma/migrations/20260909000000_restore_schema_history/migration.sql
- scripts/postgres-concurrency.test.mjs
- scripts/postgres-history.test.mjs
- scripts/postgres-integration.mjs
- scripts/postgres-integration.prisma.config.ts
- scripts/postgres-test-target.mjs
- scripts/payment-event-receipt.test.cjs
- scripts/postgres-booking-http.test.mjs
- scripts/stripe-test-e2e.mjs

Existing files changed:

- scripts/payment-preflight.sql (alias only)
- scripts/payment-postflight.sql (alias only)
- libs/common/src/payment-events.ts (first-receipt collision and completion race)

Unrelated existing changes preserved byte-for-byte (SHA-256 checked):
.yarn/install-state.gz, apps/web/src/pages/Account.jsx, package.json.
No mobile access. This inventory is the pre-staging record; final staging and commit
identity are reported separately after the authorized commit. No push or deploy.
Dedicated test databases/container remain available for inspection; their tmpfs data
will not survive container shutdown. Ignored logs preserve sanitized test reports.

P0 #5 core test matrix complete: YES, within the evidence boundaries above.
Ready for Stripe Test: YES; hosted test is a separate release gate.
Ready for production money: NO.
The test runners do not stage, commit, push, deploy or access mobile.

## Final 13-file review and release decision — 2026-09-14

This review changes documentation only. The application fix, SQL repair and tests are
the implementations covered by the 227 passing checks above. Production was not accessed.

| File | Scope and review result |
| --- | --- |
| libs/common/src/payment-events.ts | PASS: narrow receipt collision recovery; no signature/auth bypass, no processor-mode branch |
| scripts/payment-preflight.sql | PASS: PostgreSQL alias repair only; read-only, counts only |
| scripts/payment-postflight.sql | PASS: PostgreSQL alias repair only; read-only, counts only |
| libs/db/prisma/migrations/20260909000000_restore_schema_history/migration.sql | PASS for commit: restores existing schema contract; fails on incompatible structure; production-copy rehearsal required |
| scripts/payment-event-receipt.test.cjs | PASS: synthetic errors and IDs; eight unit tests |
| scripts/postgres-test-target.mjs | PASS: dedicated loopback/container/role/database allowlists; test credentials read from ignored local file |
| scripts/postgres-integration.prisma.config.ts | PASS: explicit disposable datasource, no dotenv or production fallback |
| scripts/postgres-integration.mjs | PASS: fresh-schema gate; explicit migration invocation and sanitized evidence |
| scripts/postgres-concurrency.test.mjs | PASS: real database locks/failures; synthetic processor observations |
| scripts/postgres-history.test.mjs | PASS: synthetic historical corruption and negative DDL tests; no production data |
| scripts/postgres-booking-http.test.mjs | PASS: real Nest/JWT/Prisma, loopback processor simulator, isolated fault injection |
| scripts/stripe-test-e2e.mjs | PASS: explicit Test-only entry point, live-key rejection, dedicated DB; browser artifacts remain ignored |
| docs/POSTGRES_INTEGRATION_RESULTS.md | PASS: technical evidence, Test object identifiers and release procedure; no credentials or customer data |

Fixture prices, synthetic identities, loopback addresses and the documented Stripe test
payment method exist in test tooling only. The Test runner's mode rejection and event
filter are harness isolation, not production authorization or payment logic. Production
does not import these scripts. Fault-injection triggers and module overrides are test
mechanisms, not runtime debugging hooks. No permanent Test object ID is added to runtime.
The migration restores column definitions for existing verification/itinerary models;
it adds neither document upload behavior nor an enabled itinerary payment feature.

Excluded, unchanged by this block: .yarn/install-state.gz, apps/web/src/pages/Account.jsx,
root package.json. Also excluded: logs, browser profiles, CLI configs, screenshots, dumps,
generated builds, credentials, backups and mobile. The documented Test object IDs below
are technical correlation identifiers, not API keys, Checkout access URLs or client secrets.

The accurate commit message is:
`fix(payments): restore migration history and harden webhook receipt`
because this includes executable migration repair and a runtime concurrency fix, in
addition to tests/documentation. A test-only prefix would understate the change.

### The USD 120 trace: authority, correlation and final state

Rechecked with selected technical fields against the same disposable PostgreSQL DB
after the hosted run. No Stripe request or production connection was needed for that review.

| Stage | Authority and observed behavior |
| --- | --- |
| Traveler | Synthetic signed JWT verified by the real auth mechanism against a seeded DB user; browser identity fields are not trusted |
| Booking price | PostgreSQL Listing.price_from = 120, currency USD; Wadatrip calculates 12000 cents for one traveler and persists the total |
| Inventory reservation | Listing row lock and DB availability/occupancy under transaction; one of two places is held |
| Payment preparation | Wadatrip creates one PaymentRecord and immutable request, then booking becomes payment_pending; inventory stays held |
| Checkout Session | Stripe receives that server total and stable payment idempotency key; object ID is associated with the same booking/ledger |
| Hosted payment | Actual Stripe Test Checkout reports payment paid for 12000 usd; Stripe is authority for its financial outcome |
| Signed events | Actual CLI-forwarded events pass the application's raw-body signature check; persisted associations and expected amount/currency are checked |
| Settlement | Wadatrip transaction locks event then listing, applies its lifecycle/inventory rules and commits booking, ledger, inventory cache and event completion |
| Return/verification | Runner verifies final state directly in PostgreSQL. Its return page is a local test callback; it does not test rendered React CheckoutSuccess or deployed frontend |

Correlation for run mu1gscwx (all synthetic/Test):

| Object | Identifier |
| --- | --- |
| Listing | listing-mu1gscwx |
| Booking | cmu1gsfdr0003fln0376ccqfy |
| PaymentRecord | 226d6090-cdb7-4c0a-9413-8e186aee0e06 |
| Checkout Session | cs_test_a1Dgwn0ghAWOND015GvaFrR1olmwuusurwWAOcCtzaZ6ITw5mAwE57CmRO |
| PaymentIntent | pi_3UFcrDAHNOOTJQKY1ytF7EDR |
| payment_intent.succeeded | evt_3UFcrDAHNOOTJQKY1oHXfUHl |
| checkout.session.completed | evt_1UFcrFAHNOOTJQKYfwqE3HxW |

The checkout idempotency key is derived from the persisted ledger:
`wadatrip:payment:<payment_record_id>:checkout:v1`. It is not derived from the browser.
The event primary key deduplicates delivery; event-row locking plus processed_at checked
inside the financial transaction prevents applying the same event twice. Different event
IDs for the same payment are handled by verified association and monotonic transitions,
not just by event-ID deduplication.

Observed event order was intent success (16:35:51.664 UTC), then checkout completion
(16:35:51.896 UTC). Both events finished processed, attempts=1, processed_at non-null,
with matching booking_id/payment_record_id. The second event retained the successful
state. Two additional locally re-signed replays retained one ledger and confirmation;
these are not a claim that Stripe's redelivery infrastructure itself was tested.

Final database state:

- bookings: confirmed, payment_status=paid, inventory_state=held, num_people=1,
  total_price=120, amount_cents=12000, currency=usd; both external references match ledger.
- PaymentRecord: succeeded, processor=stripe, flow=checkout, resolution=NULL;
  expected and observed amount=12000, currency=usd; commission_cents=0,
  amount_net_cents=12000. This ledger net is not proof of Stripe fee-adjusted settlement.
- listing_availability: spots_total=2, spots_available=1. No capacity increase.
- PaymentEvent: two correlated processed events, one row per external event ID.
- No Connect account, OperatorWallet payout, operator transfer, email delivery or payout
  destination was demonstrated. The provider lacked stripe_account_id, using the existing
  platform fallback. This test therefore proves collection, not marketplace settlement.

Closing the browser does not remove the signed webhook path or the persisted reservation.
On a delivered valid success event, the server can confirm independently of the redirect.
That is supported by the exercised server path and code; browser closure immediately after
payment was not separately injected in the hosted run. The actual React success page uses
JWT-protected reconcile and booking reads and never treats a query parameter as confirmation;
its deployed behavior remains a release smoke test.

### Evidence separation

| Scenario | REAL POSTGRES / REAL STRIPE TEST | SIMULATED / UNIT |
| --- | --- | --- |
| FOR UPDATE and last seat | Real locks, independent Prisma pools, pg_blocking_pids, one booking and one rejection; Gateway/Hub HTTP contention also real DB | Unit occupancy fixtures supplement this |
| Transaction rollback | Real rollback, terminated backend before commit and during session attachment, persisted outcome after disconnect | External session in attachment-failure case is loopback SDK simulation |
| Duplicate webhook | Real concurrent event receipt/settlement on PG; hosted Test produces two real event types | Concurrent same-ID financial observations are synthetic; hosted same-ID replays are locally signed |
| Webhook retry / PaymentEvent retry | Real PG failed row reprocessed to completion on second attempt | Processor observations synthetic; receipt error classification unit-tested |
| Payment success | Actual hosted Stripe Test and signed delivery settle actual PG rows | Lifecycle matrix also uses synthetic observations |
| Cancellation versus success | Concurrent PG transactions preserve consistent final state | Success observation synthetic; no hosted Stripe cancellation race injected |
| Checkout expiration | First actual Test session expired and actual event released its hold | Other terminal/failure combinations tested locally |
| Fresh migration | All 14 migrations applied to actual empty PostgreSQL | Five migration-contract tests inspect SQL rather than execute it |
| Historical migration | Real PostgreSQL, synthetic historical rows, expected constraint failure and rollback | Dataset is constructed; not a production snapshot |
| FK / UNIQUE / NOT VALID / indexes | Real catalog inspection, rejected writes, failed validation over retained orphan | Static contracts supplement actual DDL evidence |
| Late success / refunds / out-of-order | Real PG lifecycle writes with synthetic observations | No actual Stripe refund, dispute, decline or 3DS lifecycle exercised |

Totals: 192 unit/static tests, 20 PostgreSQL core tests, 7 PostgreSQL historical tests,
8 HTTP tests backed by PostgreSQL and a loopback processor = 227. The hosted Stripe Test
run and migration CLI gate are separate evidence, not extra invented unit test counts.

### Authorized-copy migration rehearsal: procedure, not execution

No current production data, migration history or dashboard configuration was inspected.
Do not run the disposable synthetic test runners against a production copy: they provision
their own fixtures and are not a backup/rehearsal tool. Do not reuse the root dotenv Prisma
config. Never run a seed script or Stripe E2E against copied historical rows.

1. Obtain explicit authorization for a consistent snapshot of the current database and
   identify its owner, capture time, DB engine/version, schema and exact deployed commits.
   Store the encrypted backup outside Git/logs with restricted access and defined deletion
   date. Prove restore works. A schema-only export cannot validate historical data safety.
2. Restore into a separate disposable PostgreSQL instance with no application ingress or
   payment/email/network egress. Match the production major version, extensions, timezone
   and connection settings. Its credentials must grant no production access. A copied DB
   may contain PII and live references: keep it restricted; do not dump rows into reports.
3. Configure two explicit connections: a read-only reporting role and a clone-only migration
   role. Use a named libpq service plus a protected passfile, never a password in a command
   or report. Verify host/port/current_database/current_user before each phase. For local
   rehearsal use a separate loopback port (for example 55439) and DB wadatrip_rehearsal;
   reject any target not matching the approved clone identity. Do not reuse port 55435.
4. Capture baseline exact row counts for users, providers, listings, listing_availability,
   bookings, PaymentRecord, PaymentEvent and OperatorWallet when present. Capture
   _prisma_migrations names/checksums/completion flags, column types/nullability/defaults,
   foreign-key definitions, checks and index definitions/validity. Never select migration
   error logs or event payloads wholesale; inspect errors privately and record categories.
5. Run payment-preflight.sql through the read-only clone connection. It reports duplicates,
   missing ledgers/orphans, null financial values, legacy statuses, unresolved events,
   invalid participants, duplicate availability days, excess occupancy and reference/state
   contradictions. Compare counts with reviewed historical exceptions; unknown is not zero.
6. If preflight cannot run because its legacy tables/columns are absent, record that failure.
   On the clone ONLY, stage the exact existing migrations through the recovery migration
   in a separate migration directory, with unchanged checksums and migration_lock.toml.
   Apply that prefix after baseline capture, then run preflight BEFORE lifecycle DDL.
   Do not silently create missing history or mark migrations applied. If a pending migration
   already has matching/unmatching manual DDL, stop and resolve that history explicitly.
7. Snapshot the clone before each DDL phase. Prepare an isolated Prisma config with absolute
   schema/migration paths and an explicitly verified clone URL; no dotenv imports. Use
   Prisma migrate status, then migrate deploy with that config, never migrate dev, db push,
   reset or automatic resolve. If using the prefix above, deploy the full exact chain only
   after its preflight passes. Rehearse precisely the same sequence intended for release.

Command forms, to execute only after the clone identity/configuration has been approved:

```powershell
# Service entries and config below are prepared for the clone; no production defaults.
psql -X 'service=wadatrip_rehearsal_ro' -v ON_ERROR_STOP=1 -c 'SELECT current_database(), current_user, version();'
psql -X 'service=wadatrip_rehearsal_ro' -v ON_ERROR_STOP=1 -f scripts/payment-preflight.sql
node node_modules/prisma/build/index.js migrate status --config <approved-clone-only-config.ts>
$migrationStarted = Get-Date
node node_modules/prisma/build/index.js migrate deploy --config <approved-clone-only-config.ts>
$migrationExit = $LASTEXITCODE
$migrationSeconds = ((Get-Date) - $migrationStarted).TotalSeconds
if ($migrationExit -ne 0) { throw 'Migration failed; keep writes disabled and inspect privately' }
psql -X 'service=wadatrip_rehearsal_ro' -v ON_ERROR_STOP=1 -f scripts/payment-postflight.sql
```

The config path above is deliberately a required approved input, not an executable fallback.
The preflight/postflight files contain no data-changing statements and use READ ONLY,
ON_ERROR_STOP and bounded timeouts. Their corrected aliases were executed on real PG.
Both migration files have explicit transactions, 5-second lock_timeout and 120-second
statement_timeout. Build, validate, generate and normal startup do not invoke them.
scripts/dev-all.ps1 requires explicit -Migrate for migrations and starts paused services;
do not use that broad launcher for this release. Hosted platform build/start/pre-deploy
commands must still be inspected in the separately authorized deployment review.

8. While migrating, use a second clone connection to sample lock waits without SQL text:

```sql
SELECT pid, state, wait_event_type, wait_event,
       clock_timestamp() - xact_start AS transaction_age,
       pg_blocking_pids(pid) AS blockers
FROM pg_stat_activity WHERE datname = current_database();
SELECT c.relname, l.mode, l.granted, l.pid
FROM pg_locks l JOIN pg_class c ON c.oid = l.relation
WHERE c.relnamespace = 'public'::regnamespace;
SELECT conrelid::regclass AS relation, conname, convalidated,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE connamespace = 'public'::regnamespace;
SELECT indexrelid::regclass AS index, indisvalid, indisready,
       pg_get_indexdef(indexrelid) AS definition
FROM pg_index WHERE indrelid IN (
  'bookings'::regclass, 'listing_availability'::regclass,
  '"PaymentRecord"'::regclass, '"PaymentEvent"'::regclass);
```

9. Record elapsed time per phase, wait duration, error category and committed migrations.
   ACCESS EXCLUSIVE affects reads as well as writes. Deliberately retain one blocker on
   the clone to confirm timeout/rollback, then repeat on a fresh restored clone; do not
   hide failed Prisma bookkeeping with an automatic migration resolve.
10. Postflight: compare baseline row counts and privately compare historical financial/
    ownership fields. No unexplained deletions, amount changes or reference reassignment
    are acceptable. Event status derived from pre-existing processed_at and nullable new
    fields are expected changes. Compare definitions, not only index/constraint names:
    the report checks required presence, not full semantic equivalence of every object.
11. Investigate all NOT VALID constraints. They enforce new writes but do not certify old
    rows. Record an explicit, reviewed data correction plan if required; no invented values.
    After approved corrections, test VALIDATE CONSTRAINT individually on the clone and
    capture locks/timing. Required core constraints, including listing owner FK, must be
    validated before Live activation; the read-only postflight never validates them itself.
12. Smoke new app builds against the clone with payment/email egress still disabled.
    Use a separate synthetic provider/listing/traveler namespace only: authenticated
    booking, canonical amount, one ledger, loopback checkout and signed synthetic event,
    ownership denial, free booking, last-seat rejection and cancellation. Never pass copied
    live IDs into Stripe Test. Subsequent deployed Stripe Test uses a synthetic-only DB.
13. Re-run postflight and counts, accounting explicitly for synthetic smoke rows. Preserve
    restricted evidence, rehearse restoring the pre-migration clone, and confirm old code
    works on that restored pre-write snapshot. Do not claim a down migration exists.

GO/NO-GO: stop for target uncertainty, incomplete backup/restore proof, checksum drift,
failed/pending unexpected migrations, incompatible types/defaults/indexes, timeout, orphan
payments, duplicate external ownership/days, unexplained row-count changes, invalid active
participants/capacity, paid bookings without financial evidence, active unknown amounts,
unresolved financial contradictions, failed event backlog without a recovery owner, missing/
invalid indexes or failed core constraint validation. Historical nulls or terminal exceptions
need individual documented disposition; their preservation is not automatic release approval.
Any booking/payment/occupancy smoke failure is NO-GO. Do not weaken constraints or lengthen
timeouts blindly to make the rehearsal pass. No production migration is authorized here.

### Compatibility and safe rollout order

Additive columns do not make mixed lifecycle versions safe. Old Gateway can update status
without the new financial/inventory transition; old Provider Hub can bypass shared locks;
some old writes fail new constraints while other unsafe combinations remain representable.
The old frontend may omit JWT, required dates/counts or understand only earlier responses.
Ignoring its price payload is safe but does not make the whole old flow release-compatible.
New code against old schema also fails. Use a maintenance window, not a rolling writer mix.

1. Approve the clone rehearsal, immutable release artifacts, backup restore procedure and
   bounded maintenance window. Inspect the actual old deployed versions before proceeding.
2. Disable new booking/checkout/cancellation/availability writes at ingress and stop ALL old
   Gateway/Provider Hub writers, including direct service/admin paths and background writers.
   A frontend maintenance banner alone is insufficient. There is no audited universal
   booking-disable switch to assume; use verified ingress controls or take writers offline.
3. Drain in-flight DB transactions and external payment creation calls; record unresolved
   ledgers/sessions without freeing inventory. Route webhooks to a retryable non-2xx during
   unavailability, never a fake success. Do not expire unrelated sessions to simplify deploy.
4. Take the final consistent snapshot, verify identity/history and execute the rehearsed
   migration sequence with old writers stopped. Acknowledge ACCESS EXCLUSIVE read downtime.
5. Start the matching new Gateway and Provider Hub against the new schema, keeping booking
   creation closed. Restore the signed webhook handler, replay/reconcile missed events and
   check financial/occupancy state before reopening writes. No old writer may restart.
6. Release the matching frontend, correct approved API/CORS/HTTPS/return configuration,
   verify auth and critical pages, then open only the approved pilot inventory after smoke
   gates pass. Rehearse this sequence with Stripe Test before a separate Live decision.
7. Monitor initial bookings with an identified operator. Roll forward for failures after
   financial traffic resumes. Never restore an older DB snapshot while Stripe has newer
   outcomes: it loses ledgers and associations. A pre-write restore is only safe after
   proving no intervening external changes; otherwise freeze writes and reconcile first.

Stripe retries failed delivery and does not guarantee event ordering. The rollout relies
on a short outage, monitoring and explicit recovery, not indefinite retries or browser
redirects. See [Stripe webhook delivery behavior](https://docs.stripe.com/webhooks).

### Deployed release smoke checklist (not yet executed)

| Surface | Required evidence before enabling paid pilot |
| --- | --- |
| Traveler | Real sign-in/refresh/logout; listing only public data; actual bookable date and available traveler count; booking uses JWT, canonical total and held capacity |
| Checkout | Pending shown without success claim; Test hosted checkout; authenticated return/reconcile; account displays the same final state; browser-close-and-return tested separately |
| Failure UX | Anonymous/401 stops payment; insufficient places/date errors clear; cancellation pending does not promise cancellation; review says support is checking payment and does not invite a second payment |
| Operator | Correct owner sees listing availability/capacity and its booking/date/count/final state; another owner cannot access it; no stale cache or duplicate confirmation |
| Admin | Authorized admin can investigate technical booking/payment/event IDs, amount, resolution and safe status; private details stay access-controlled; customer-facing text hides internal state names |
| API | Cross-user/owner access denied; manipulated price/currency/capacity rejected or ignored as designed; last-seat collision safe; unsigned webhook rejected; duplicate event changes no outcome |
| Release boundary | Actual API HTTPS, health, CORS preflight with Authorization, frontend API base and return paths; no localhost fallback, mixed old writers or unapproved alternate payment route |

Account.jsx is intentionally preserved outside this commit; its deployed paid/review status
rendering is unproven and must pass the smoke gate. Do not infer reliable traveler/operator
notification delivery from a confirmed DB row: this run did not test email. For the pilot,
define and exercise a manual confirmation/escalation channel if automated delivery is not
reliable. Confirmation must correspond to confirmed booking and valid inventory/payment;
cancellation only to cancelled, and financial review must not look like successful booking.

### First operator: minimum bookable data and missing contracts

| Requirement | Existing support | Required pilot evidence / gap |
| --- | --- | --- |
| Owner and verification | providers.user_id, status, verified_level, approval fields | Real authorized owner, contact verified, approval sufficient for this country's activity; default community/pending is not approval |
| Published listing | listings.provider_id, status, title, description, location | Explicit published/approved listing, activity deliverable and operator agreement |
| Price and currency | price_from Decimal, currency, persisted booking totals | Agreed per-traveler price; current domain multiplies by num_people; USD only; zero tour supported; positive paid total must meet processor minimum |
| Date and capacity | one availability per listing/UTC day, spots_total/cache | Operator-supplied real dates and capacity, no duplicate days, correct occupancy; no invented calendar |
| Start time / meeting point | description, duration and date range only | No canonical timezone/start-time/meeting-point fields or intraday slot model; pilot needs one unambiguous departure per day, exact local time/zone and meeting instructions agreed and communicated |
| Cancellation policy | No versioned policy/acceptance snapshot on booking | Approved policy, customer disclosure, operator agreement and manual refund responsibility before accepting money |
| Operational contact | private provider email/phone, languages/country/city | Tested private traveler/operator/support contact, response owner and fallback; no public exposure of private fields |
| Payment recipient | provider.stripe_account_id | An ID is not readiness. Verify correct account, country, capabilities, charges/payout status, requirements and actual settlement recipient |
| Payout destination | Stripe-managed connected account | No proven payout destination or transfer in this test; verify through authorized Stripe onboarding/Test, not a DB value alone |
| Commission | WADATRIP_FEE_PCT, ledger commission/net | Default is 15 percent only when checkout uses connected destination; agree the actual fee/Stripe-cost/refund allocation and verify expected ledger split |
| Tax and activity responsibility | No tax engine or contractual responsibility snapshot | Decide supported jurisdiction, seller/merchant role, receipts, taxes, permits/insurance and responsibility with qualified advice; no automatic tax-compliance claim |

Existing readiness gaps: checkout silently takes a platform collection fallback without a
connected account; create-intent does not apply the checkout transfer/commission arrangement;
the legacy itinerary checkout is outside this booking ledger lifecycle. Before Live, expose
only the approved marketplace checkout path or separately prove equivalent safety/settlement
for every reachable payment route. Pausing the AI service alone does not prove the itinerary
payment endpoint is inaccessible. No changes to these routes are made in this block.

Missing dedicated policy/timezone/settlement-readiness fields are not permission to invent
a full new system. A tightly constrained pilot may use reviewed external agreements and
clear listing instructions, but each required fact and recovery owner must actually exist.
No actual first operator dataset was inspected here: FIRST OPERATOR DATA READY = NO.
Verify onboarding state rather than the existence of an account ID; see
[Stripe account verification](https://docs.stripe.com/connect/handling-api-verification).

### Objective Live gate and owner decision

MUST BEFORE LIVE:

- Authorized-copy migration rehearsal, history compatibility, restore proof, required
  constraint validation and zero unresolved active financial/inventory contradictions.
- Coordinated rollout rehearsed; all writers use the same protocol; no uncontrolled
  alternate payment route. Deployed Test smoke passes actual sign-in, account/operator/admin
  status, API/CORS/HTTPS and signed webhook delivery without a developer CLI dependency.
- Hosted Test decline/3DS, expiry, browser-close recovery, cancellation/payment race and
  existing Connect/commission/settlement path verified for the chosen pilot. Refund process
  and event handling tested; no double refund and no misleading confirmation.
- One approved operator with real inventory, policy, departure instructions, settlement
  recipient and agreed responsibilities. Correct supported country/currency and fees.
- Named manual reconciliation/refund owner and procedure; technical correlation logs,
  event failure/backlog and aging hold review, backup access, incident contact and ability
  to stop new payments. No unowned indefinite holds or unresolved charged customer cases.
- Separate explicit authorization for Live credentials, webhook destination and first
  controlled real payment. No secrets in web bundle, no Test/Live reference mixing.

SHOULD BEFORE LIVE:

- Run on matching production Node/PostgreSQL versions and service topology; measure lock
  waits/timeouts and document operator recovery for transient DB failures.
- Improve account/admin status language if release smoke finds confusion; automate minimal
  notification delivery checks and basic financial alerts where manual monitoring is weak.
- Rehearse loss of commit acknowledgment and a prolonged processor outage; define support
  response targets and inspect abandoned holds on a fixed daily schedule.

CAN FOLLOW AFTER FIRST BOOKINGS (only while manual pilot controls are adequate):

- Automated abandoned-hold reconciliation/expiry, refund automation, richer operator views,
  additional currencies/providers, load optimization and more elaborate observability.
- Dedicated policy/version and schedule modeling beyond the narrowly supported pilot,
  provided required disclosures and per-booking terms are already reliably retained.

Decision: approve this bounded P0 #5 commit; do not approve production money. Quality
scores are engineering judgments, not reliability probabilities: core 8/10, payment 8/10,
inventory 8/10, operability 5/10, production readiness 4/10.

Top remaining risks: actual DB history/data compatibility; mixed-version deployment and
unproven public frontend; operator settlement/commission and alternate payment routes;
unowned reconciliation/holds/notifications; missing verified first-operator policy and data.

If this were my company, I would next obtain authorization for an isolated current-DB
snapshot and execute the migration rehearsal with egress disabled, while collecting the
first operator's missing facts. Then I would approve the coordinated Test deployment and
its real user/settlement smoke tests. Only after every MUST gate passes would I consider
a separately authorized, tightly monitored first Live transaction.
