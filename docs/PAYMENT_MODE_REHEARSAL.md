# Payment mode migration: authorized backup rehearsal

Executed locally on 2026-10-13, using the existing authorized encrypted backup from
**2026-09-15 19:46 UTC**, not a new export of production. This evidence covers that
snapshot. It does not describe current production balances, payments, inventory or users.
No Stripe API or production database was contacted. No worker/email processing was started.

## Environment and preservation

PostgreSQL **17.9**, existing disposable container with an internal Docker network,
verified scope label and no volume/bind mounts. Backup DPAPI decryption stayed in memory;
the archive SHA-256 matched the previously recorded value. Restore used a new database,
one transaction, no owners/privileges, and preserved the original backup.

| Check | Result |
|---|---|
| Restored source | 69 bookings, 1 PaymentRecord, 1 PaymentEvent, 18 finished migrations |
| Earlier additive migrations | Applied through the 25-file pre-mode chain |
| Mode isolation migration | Applied; total 26 finished migrations |
| Pre-mode upgrade duration | 2.48 seconds |
| Mode upgrade duration | 1.90 seconds, including Prisma process overhead |
| Original business data | Fingerprints/counts of every original column in all 21 business tables unchanged |
| Original migration history | Original checksums/timestamps/steps unchanged |
| New mode CHECK constraints | All three present and validated |
| Core constraints/indexes | Postflight reports none missing |
| Financial events | None executed or marked processed |

Final regression: **261/261 tests passed**, including 22 with real disposable PostgreSQL
(20 core concurrency tests and 2 mode-migration/report tests). All processor observations
in those tests are synthetic; this is not a new Stripe Test E2E. The production backup
rehearsal above is additional evidence, separate from those synthetic test datasets.

The initial local database was empty despite its expected name; it was not treated as a
restored snapshot. A first attempt against a fresh restored clone returned **P1001** because
the host port was unavailable. That clone and encrypted diagnostics were retained. The
successful attempt used the already available pinned Prisma image on the internal network,
without opening ports, downloading images or changing infrastructure.

## Historical triage: snapshot only

| Finding | Count | Decision |
|---|---:|---|
| Booking expected amount unknown | 54 | Preserve unknown; do not infer from current listing price |
| External booking references with unknown explicit mode | 9 | Investigate; no automated processor operation |
| Those references: pending/unpaid, known booking amount, no ledger | 8 | Old Test prefix is a hint; does not prove processor outcome or safe expiry |
| Those references: confirmed/paid, unknown booking amount, legacy paid ledger | 1 | Financial/customer obligation review; no recomputed historical amount |
| Ledger with unknown mode and pending/external evidence | 1 | Excluded from automatic jobs until explicitly verified |
| Unfinished refund with unknown mode | 0 | Snapshot only; obtain fresh counts before deployment |
| Unprocessed event with unknown mode | 1 | Keep pending; do not replay for migration verification |
| Confirmed/completed without sufficient ledger backing | 1 | Postflight exception remains; do not equate with another case without association evidence |
| Occupied days without availability | 22 | Legacy exception; never fabricate availability |
| Legacy inventory state NULL | 69 | Preserved, handled conservatively by existing occupancy rules |
| Unvalidated core constraints | 7 | Unchanged historical validation debt |
| Duplicate external ownership / availability days | 0 / 0 | No repair needed in this snapshot |
| Capacity exceeded / cached capacity mismatch | 0 / 0 | No repair needed in this snapshot |
| Explicit Test / Live ledger modes | 0 / 0 | Migration intentionally performs no backfill |
| Legacy provider payout reference without explicit mode | 1 | Never promote the reference to Live |

All nine booking references have a `cs_test_` prefix locally. This is not sufficient to
classify all associated intents/events or assert financial settlement. Classification requires
retrieval in the correct Stripe account/environment, matching persisted booking/ledger IDs,
amount/currency, current processor outcome and any refund. Ambiguous history remains unknown.

`scripts/payment-mode-readiness.sql` is a repeatable-read, READ ONLY count report. It covers
references stored only on Booking as well as PaymentRecord, unresolved refunds/events and
mode conflicts. It does not print contacts, payloads, credentials or classify/update records.

## Deployment gate

The rehearsal passes for this backup. **Production rollout is still not approved.** Before
deployment obtain fresh authorized preflight/backup, verify the actual current migration chain,
and account for all pending payments/refunds that the stricter worker would exclude. This old
snapshot predates the latest pilot transactions; it cannot establish that those jobs are safe.
Do not migrate and restart old writers as though they enforce mode isolation. Stop financial
writers, migrate, start compatible code, then run auth/price/inventory/webhook smoke checks in Test.
Never silently backfill unknown records or reprocess historical events to make counts green.

## Operator payout decision remains external

The current pilot code uses a US platform, PE Express recipient and destination charges without
`on_behalf_of`. Stripe's public cross-border documentation limits self-service to US/UK/EEA/CA/CH
and directs recipient agreements to Global Payouts. This does not establish an account-specific
approval for Wadatrip's current PE route. [Cross-border payouts](https://docs.stripe.com/connect/cross-border-payouts),
[service agreement types](https://docs.stripe.com/connect/service-agreement-types).

Confirm the real legal payee and domicile first. Then obtain Stripe confirmation for the exact
flow, supported payout currency, costs and refund/transfer reversal behavior. Do not substitute
a US phone number or platform address for the operator's actual country, create a Live account
before approval, or change payment architecture based only on Sandbox success.

Prepared question for Stripe support (not sent):

> Wadatrip operates a tours marketplace through a US platform. Our pilot's legal payee and
> domicile are being verified. Sandbox currently uses a PE Express recipient, transfers capability
> and destination charges with application_fee_amount, without on_behalf_of. Is that exact route
> approved for our platform in Live? If not, what supported route and approval would be required?
> Please confirm payout currencies/timing, charges/refund/transfer reversal support and applicable
> processing, Connect and cross-border fees before we accept customer funds.
