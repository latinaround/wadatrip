# Payment mode isolation and launch controls

This block is local implementation. It does not enable Live, change hosted configuration,
apply a production migration, or establish operator eligibility for cross-border payouts.

## Contract

- Wadatrip owns canonical price, ownership, booking lifecycle and inventory. Stripe reports
  processor state. Existing transactions, signatures and idempotency remain required.
- Newly prepared PaymentRecords and newly received signed events store `processor_mode`.
  The active credential must have an unambiguous Test/Live prefix; conflicting aliases fail closed.
- External Sessions/Intents/events must report the same `livemode` as the active credential.
- Provider Test and Live payout references are separate. The original account field is a
  legacy Test fallback only. It is never automatically promoted to Live.
- Historical NULL modes remain unknown. Test allows guarded investigation/reconciliation;
  Live rejects them. Automatic payment/refund workers select only explicitly matching modes.
  No migration infers mode from IDs, current environment, or present listing price.
- The pilot uses hosted booking Checkout only. New direct PaymentIntents and itinerary
  checkouts return 503 after authorization. Recovery of already existing flows remains available.

## Controls

| Variable | Behavior |
|---|---|
| `PAYMENTS_ACCEPT_NEW=false` | Stops new Checkout/Connect requests; leaves webhook and existing-payment recovery enabled |
| `PAYMENTS_LIVE_ENABLED=true` | Necessary but insufficient for Live admission |
| `PAYMENTS_ACCEPT_NEW=true` | Explicit consent required in Live |
| `PAYMENTS_LIVE_PROVIDER_IDS` | Exact comma-separated provider IDs permitted for Live admission |
| `WADATRIP_FEE_PCT` | Explicit valid 0–100 percentage required for Live; Test retains the existing default |

These are server controls. They do not substitute for legal/operator approval or prove payout
eligibility. Closing Checkout does not expire/cancel existing processor objects or release their
capacity. Booking creation is a separate operation: a failed/disabled checkout can leave a
pending reservation, which must be cancelled through the existing safe lifecycle.

## Migration and rollout prerequisites

The migration is additive: nullable columns, checks and indexes, without historical backfill.
Rehearse it against an authorized copy before production; the disposable synthetic test is
not a substitute. New code requires the columns: apply schema before starting that code in a
controlled window with old financial writers stopped. Old writers cannot enforce mode isolation.
Do not mix old/new payment workers. Do not remove columns as a rollback while new code runs.

Before deploying, inspect unresolved payments/refunds and approve how historical unknown
records will be handled. Otherwise this intentionally stricter worker can stop a historical refund
from advancing. Classify only with verified processor evidence and authorized database updates;
do not mark every record Test because current credentials are Test. Keep recovery ownership
and alerting for excluded unknown records explicit.

One Gateway process uses one active Stripe environment. Switching its key does not process
old Test history through Live. Close/resolve Test flows or retain a separately isolated Test
environment before cutover. Do not change keys while assuming the worker will recover both modes.

Before Live: verify the exact legal operator/country/payout route, approve commission and fees,
establish a separate Live payout account and signed Live webhook, and complete a new Test
booking with browser closed after payment. Readiness displayed in Test does not prove Live readiness.

## Validation

`scripts/payment-launch-safety.test.cjs` uses synthetic credentials and mocked processor/DB.
`scripts/payment-mode-postgres.test.mjs` runs the real migration chain and an upgrade from
the prior chain on guarded disposable PostgreSQL with synthetic history. It checks actual
mode checks/indexes/uniqueness, retained NULL amounts/modes and unchanged legacy references.
The existing PostgreSQL concurrency suite exercises real booking/payment locks separately.
No validation in this block calls Stripe or a production database.

Local validation on 2026-10-13: 238/238 isolated core tests and 22/22 real disposable
PostgreSQL tests passed. Common, DB, Gateway and Provider Hub TypeScript builds passed;
Prisma validate/generate passed using an explicit synthetic localhost configuration.
The frontend is unchanged. Five failure cases were reproduced before their fixes, including
the final nested PaymentIntent mode mismatch. A synthetic migration rehearsal does not
authorize applying this migration to production or enabling Live.

Final code review added one early validation: a nonempty but invalid Live fee configuration
must fail before processor setup. The regression was reproduced before the fix; the existing
fee validator is reused. After that correction **240/240 local core tests** and the Common,
DB, Gateway and Provider Hub builds passed, as did Prisma validate. The earlier **22/22 real
PostgreSQL tests** remain separate evidence; they were not rerun for this Gateway-only change.
No frontend design, commission percentage or production configuration was changed.

Follow-up: the migration also passed on a new restore of the existing authorized September
backup in PostgreSQL 17.9. See [rehearsal results](PAYMENT_MODE_REHEARSAL.md) for preservation,
historical exceptions and snapshot limits. The current production dataset still requires a fresh
authorized preflight before rollout. The read-only mode report is `scripts/payment-mode-readiness.sql`.
