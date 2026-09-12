# Booking, inventory and payment core

PostgreSQL owns Wadatrip booking/inventory state. Stripe reports processor facts. This core
adds no provider, worker, refund executor, queue, scheduler or mobile functionality.

## Invariants and transitions

A new paid confirmation requires verified money, a matching DB reference or persisted
payment request, and held capacity. A free booking confirms in its inventory transaction
without a PaymentRecord or Stripe operation. New bookings validate future dates and
published listings; settlement of an existing payment does not apply the new-booking date
rule. A late success still validates participants and the existing day allocation.

PaymentRecord.status normalizes historical paid to succeeded. Succeeded never regresses
to pending/failed; refunded never regresses to succeeded. An unverified legacy failed
status is not proof that its external intent cannot still complete. Unknown amounts remain
null, not zero. Expected amount/currency and observed money are separate.

Booking.inventory_state explicitly stores held/released. Null is a legacy compatibility
case: cancelled/rejected implies released; other states retain inventory conservatively.
Reconciliation does NOT imply release. Previously invalid history is detected, not repaired
by inventing seats, amounts, references or participants.

The pure domain function bookingTransition defines business decisions; no external API
is called there. Capacity allocation starts with HOLD in createCapacityBooking.

| Event / precondition | Booking result | Payment result | Inventory | Notification permitted |
| --- | --- | --- | --- | --- |
| New free booking, valid day/capacity | confirmed | No ledger; booking paid compatibility flag | HOLD | Confirmation |
| New paid booking, valid day/capacity | pending | No ledger yet | HOLD | No payment confirmation |
| Persist payment operation | payment_pending | pending | KEEP | No |
| Retryable card decline / processing | unchanged | pending | KEEP | No |
| Cancel before any financial risk | cancelled | No new ledger | RELEASE | Cancellation |
| Cancel while payment may complete / legacy failed unverified | cancellation_pending | Preserve financial evidence | KEEP | No cancellation confirmation |
| Verified terminal cancellation/expired session without live intent | cancelled | failed | RELEASE | Cancellation |
| Verified success, held valid capacity | confirmed (or existing completed) | succeeded | KEEP | Confirmation only on transition to confirmed |
| Success after cancellation request or valid cancellation | reconciliation_required | succeeded + refund_required | RELEASE | No success confirmation |
| Success with insufficient capacity | reconciliation_required | succeeded + refund_required | KEEP existing allocation | No |
| Financial amount/currency mismatch | reconciliation_required | Record actual money, review required | KEEP | No |
| Ambiguous association | reconciliation_required | Do not overwrite canonical financial evidence | KEEP | No |
| Partial refund on a valid reservation | confirmed/completed | succeeded + review required | KEEP | No new confirmation for an already confirmed booking |
| Verified full refund on the canonical payment | cancelled | refunded; close financial review | RELEASE | Cancellation |
| Full refund while association remains disputed | reconciliation_required | Canonical financial result only | KEEP | No |
| Reconciliation resolved with verified paid state and valid held allocation | confirmed/completed | succeeded | KEEP | Confirmation only if newly confirmed |

There is no new admin endpoint that lets a client claim reconciliation_resolved or money
success. Partial-refund/capacity review can close on trustworthy processor evidence and
valid inventory; an identity/history dispute cannot be cleared by repeating a browser
request. A later canonical full refund can close a price mismatch without guessing the
historical expected amount.

## Locks and atomicity

All booking creation, status transitions, payment preparation and settlement use Prisma
interactive transactions at ReadCommitted. They execute the parameterized SQL
SELECT id FROM listings WHERE id = $1 FOR UPDATE before reading occupancy. Slot selection
then locks the matching listing_availability row with FOR UPDATE. A payment event first
locks its own PaymentEvent row. Global order: event (when present), listing, then dependent
booking/payment/availability writes. Each operation locks only one listing.

Locks last until transaction commit/rollback. Gateway instances and Provider Hub use the
same shared functions and the same PostgreSQL rows, so separate processes serialize on
the listing lock. Occupancy is read after obtaining the lock, using held bookings and the
conservative legacy fallback. The listing/date index supports this query. Invalid existing
participant counts fail closed, including a negative count hidden in a nonnegative sum.

No Stripe API calls execute inside these transactions. The mutex fixtures check application
ordering and atomic outcomes, not PostgreSQL lock semantics or deadlock behavior. Real
multi-connection tests are still a gate. Deadlocks/timeouts cause rollback and retry of the
same operation; never a new payment key. Unmanaged/direct DB writers remain outside the
application locking protocol and must not write inventory during operation.

## One external operation per booking

PaymentRecord.booking_id is unique. Checkout and PaymentIntent share one immutable logical
payment operation. The DB commits its parameters before external creation. Creation and
recovery use wadatrip:payment:<record-id>:<flow>:v1 with those exact persisted parameters.

Missing-ID creation is not replayed after 23 hours from record creation. Stripe guarantees
idempotency retention for at least 24 hours; uncertainty beyond that boundary retains seats
and requires investigation. A stored external ID is retrieved, never recreated. A terminal
record cannot start a replacement payment. The same key can be retried after an ambiguous
network/DB response within the recovery window.

Before expiring/cancelling an external object, verify booking, ledger, flow, persisted IDs,
nested intent metadata and unique ownership across both legacy bookings and PaymentRecord.
Retrieved checkout objects are checked before returning their URL/secret to their owner.
Metadata alone cannot establish ownership of an unbound historical payment. A managed
first webhook can precede ID persistence only when it matches the immutable DB payment
request and its record ID. External reference unique indexes arbitrate concurrent binding.

## Durable event inbox

Signature verification is mandatory. PaymentEvent.id is the processor event deduplication
key. Receive and commit a minimal envelope before external lookup when the DB is available.
State proceeds received -> processing -> processed, or failed (retryable). attempts,
last_attempt_at and error_category support investigation. Existence is never completion:
only processed_at prevents replay.

The event row lock and processed_at check serialize duplicate application. Booking,
PaymentRecord, inventory cache, transition evidence and processed_at commit together.
Failures roll back those effects, leave an unprocessed durable event, and record a safe
error category. A subsequent delivery/reconciliation retries. If the DB itself is down,
durable receipt is impossible: return an error and rely on processor redelivery or explicit
reconciliation. No background retry worker or delivery guarantee for emails is added.

The handler retrieves current processor state, so an old failure event cannot undo a paid
result. Event booking/payment IDs are indexed evidence, intentionally not restrictive FKs:
an orphan/mismatched observation must remain investigable. Only normalized technical and
financial data are stored for new events, not raw processor payloads. Historical payloads
are not rewritten or printed by the preflight.

## Recovery and notifications

Cancellation first commits cancellation_pending and keeps inventory, then attempts safe
external expiration/cancellation. Exceptions imply uncertainty, not cancellation. Retrieve
again and settle the verified result. Open/processing/retryable intents keep inventory,
including an expired checkout whose intent can still finish.

The existing authenticated reconcile endpoint performs on-demand recovery. Closing the
browser or losing a response does not change the booking result. Existing success/cancel
pages consult backend state. Free-tour notification uses the authenticated actor and the
confirmed free booking. No payment confirmation email infrastructure was added.

Structured financial logs use an allowlist: booking/record/processor/external/event IDs,
idempotency key, previous/new states, inventory action, expected/observed amount/currency,
operation, result and safe error category. Transition logs are emitted after DB commit;
normalized event transition evidence is durable. Never log raw errors, customer data,
client secrets, tokens, card details or Stripe payloads. Logging failure cannot roll back
an already committed booking.

Uncertainty can reserve capacity indefinitely. Manual refund/reconciliation remains
necessary; do not force confirmed, clear flags, increase capacity, or use another payment
key. A disputed association requires locating and verifying the actual transaction before
any repair. This release does not implement that administrative repair workflow.

## Historical migration runbook (not executed)

1. On an authorized restored copy, verify the existing schema/migration baseline first.
   This repository has older standalone SQL migrations; do not assume an empty DB or
   blindly replay all historical files.
2. Run scripts/payment-preflight.sql with psql -X and an explicitly selected connection.
   It uses READ ONLY / REPEATABLE READ, timeouts and counts only. It does not read .env.
   Duplicate external ownership/day rows block migration. Other findings block activation
   of affected financial/inventory paths until reviewed.
3. Rehearse 20260910000000_payment_lifecycle/migration.sql on that copy. It is transactional,
   uses bounded lock/statement timeouts and refuses duplicate ownership/day entries.
   No deletion, merge, financial backfill or invented inventory. Unique indexes cannot
   be added NOT VALID, so ambiguous duplicates deliberately abort the whole migration.
4. The booking FK, participant/capacity checks and nonempty-reference checks are NOT VALID:
   old invalid rows survive for investigation, while new writes must satisfy the contract.
   An update to an invalid row may fail closed. Resolve records using real evidence and
   later VALIDATE CONSTRAINT; this task neither executes nor automates those repairs.
   Nullable legacy expected money is allowed, while managed records require complete,
   nonnegative consistent USD amounts and a persisted request.
5. Run scripts/payment-postflight.sql and repeat preflight investigations. Review unknown
   inventory, pending/failed events, orphan ledgers, inconsistent references, invalid
   participants, over-occupancy, cache drift and paid bookings without ledgers. Check that
   required constraints are present and validated before production activation.
6. Use a coordinated cutover: drain old Gateway/Provider Hub writers and webhook handling,
   apply the rehearsed migration, generate the client and start compatible versions.
   Additive columns alone do not make old lifecycle writers safe in a mixed rollout.
   Do not drop lifecycle columns or blindly downgrade after new financial writes.

Prisma validation/generation and static migration contract tests are not a PostgreSQL
migration test. No migration/preflight has run on production or a real DB in this task.
No Docker/infra was started. Next: disposable PostgreSQL integration tests with historical
fixtures, duplicate gates, FK enforcement, real concurrent connections and rollback.
After that, authorized Stripe Test E2E. Production money remains blocked.

## Evidence and boundaries

The core suites cover the six original counterexamples, association-before-mutation,
historical null/paid/orphan/duplicate records, late settlement, partial/full refunds,
duplicate/out-of-order events, retry after failure, exclusive checkout and last-seat
contention. All processor/DB fixtures are synthetic; none call production or real Stripe.
See scripts/payment-lifecycle.test.cjs, booking-capacity.test.cjs and payment-migration.test.cjs.

Local validation at completion: 183 passing tests (60 lifecycle, 23 capacity, 36 price,
12 traveler auth, 48 security, 4 static migration contracts). Common, DB, Gateway,
Provider Hub and frontend builds passed, as did Prisma validate/generate and git diff
--check. Frontend retains a bundle-size warning unrelated to this core.

TDD evidence: 31 named BLOCKER cases were observed failing before their corresponding
fix and passing afterward: 17 money/association/history, 2 event recovery, 7 settlement/
inventory transitions, 1 observability and 4 static DDL contracts. The latter four prove
the migration declarations are present; they do NOT prove execution on PostgreSQL.
Six further historical/concurrent/log-safety cases supplement the original 146 tests.
No staging, commit, migration application, production access or deployment was performed.

Primary references: [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html),
[NOT VALID constraints](https://www.postgresql.org/docs/current/sql-altertable.html),
[Stripe idempotency retention](https://docs.stripe.com/api/idempotent_requests).
