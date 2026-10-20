# Operator booking alerts

Implemented locally on 2026-10-20. Not deployed; production migration has not been applied.

## Behavior

- The header and existing account dashboard links show counts of confirmed reservations the signed-in operator has not explicitly reviewed.
- The alert links directly to `/operator/tours/new?panel=operations`. It also returns to Bookings when another panel was selected in the same workspace.
- Counts and the inbox refresh on entry, browser focus, and once per minute while the tab is visible. This is not push notification delivery or a closed-browser alert; the existing email remains a separate channel.
- Only **Mark as reviewed** writes a receipt. Opening the workspace, email delivery, and GET requests do not clear alerts.
- The receipt belongs to `(booking_id, user_id)` and is stored in PostgreSQL, independent of browser storage. Another device sees the updated result on its next refresh.
- A review does not confirm, accept, cancel, reconcile or refund a booking. It changes no payment, price, inventory, email or booking lifecycle state.
- Existing confirmed bookings start unreviewed. No fabricated historical review times are introduced.

## Financial classification and ownership

- `reservations`: persisted payment mode `live`, or a free confirmed booking with canonical zero amount and no PaymentRecord.
- `sandbox`: persisted payment mode `test`. These counts never inflate the real-reservation count.
- `unverified`: absent/unknown/blank payment mode or missing PaymentRecord for a nonzero/unknown amount. Unknown remains unknown. Reviewing an alert does not resolve financial uncertainty.
- Pending, cancelled, rejected and completed bookings are not new confirmed-reservation alerts.
- Identity comes exclusively from the existing JWT and active database account, using centralized actor/verified-email checks.
- Scope is current `provider.user_id = actor.id`. Query/body identities, traveler ownership and admin status cannot grant another operator's inbox.
- Responses use an explicit projection: booking reference, tour title, date/timezone, travelers and canonical amount/currency. No email, phone, Stripe ID, token or raw booking terms.
- No auth cache or token is added to browser storage. Logout/account changes discard the previous inbox; expired requests use the existing logout mechanism.
- Read errors are shown as unavailable, not a successful zero count. Failed review can be retried safely.

## API

- `GET /operator/booking-inbox`: consistent Repeatable Read snapshot, counts over all matching rows; up to 20 latest unreviewed items per category with stable ordering. No Stripe calls.
- `POST /operator/booking-inbox/:id/review`: verifies current operator ownership and confirmed status; records the first review with `INSERT ... ON CONFLICT DO NOTHING` through Prisma `createMany(skipDuplicates)`, then reads its timestamp in the transaction.
- Reviewing more than one page reveals the next unreviewed items. No acknowledge-all endpoint.
- Two concurrent reviews create one receipt and retain its original timestamp.

## Additive migration and release order

`20261021000000_operator_booking_reviews` creates one empty table, a composite primary key, two foreign keys (bookings/users), and an owner/time index. Existing business tables and historical amounts are not updated or backfilled. Lock timeout: 3 seconds; statement timeout: 15 seconds.

1. Review the exact release diff, preserving previous unrelated work. This block includes no Stripe configuration change.
2. On an authorized disposable copy, confirm the migration history and that the new table is absent or matches its recorded migration. Do not resolve or overwrite unknown migration history.
3. Apply the migration through the reviewed migration workflow with an explicit target. It is not part of these test/build/generate commands. Do not run a root command against an unverified `.env`.
4. Verify the new table, both foreign keys, composite key and index. On the quiescent rehearsal copy compare original business rows/counts before and after.
5. Deploy gateway code, then frontend. Old code can coexist with this additive table. Do not publish the new UI with an absent backend route/table.
6. Smoke test as traveler, owner A and owner B, including a Test reservation and a read receipt. Never create a Live charge for this release check.
7. If application rollback is needed, revert application versions and retain the additive table/receipts. Do not delete financial records or drop the table as an improvised rollback.

No production migration, commit, push, deploy, Stripe API request, email send or mobile change is performed by this implementation block.

## Evidence

- 10 local HTTP tests: real Nest routing/JWT; synthetic Prisma. Authorization, isolation, classification, safe projection, idempotence, pagination, and no business mutations.
- 12 local browser tests: mocked APIs/external resources blocked; explicit review and retry, reload, focus refresh, mobile/tablet/desktop widths, account switch, expiry, backend failure, and same-workspace navigation.
- 7 real PostgreSQL 17 tests: new isolated Docker container, synthetic historical schema/data, two independent Prisma connections. Nullable legacy modes, historical preservation, concurrent review, owner change isolation, FK constraints, unique key/index and rollback. This is a focused additive-migration test, not a rehearsal on a copy of production or a retest of the whole migration chain.
- 15 existing account-context browser tests and 17 discovery browser tests pass.
- Existing synthetic suites pass separately: security 52; traveler auth 13; price 36; capacity 24; booking notifications 16; payment lifecycle 62; payment event receipt 8.
- Gateway, DB and frontend builds pass; Prisma validate/generate pass; `git diff --check` passes.

Environment issues were kept separate from product defects: native PostgreSQL lacked `postgres.bki`; Docker initially was stopped; Docker Desktop internal-network publishing could not reach Windows loopback. The final PostgreSQL test uses a dedicated bridge, a random port published **only on 127.0.0.1**, cached PostgreSQL 17 image ID with pull disabled, generated synthetic credentials, and tmpfs storage. It removes only its own labelled container/network afterward. Existing local services are not used or reset.

The browser tests reproduced and verified fixes for same-URL panel navigation and narrow-screen count overflow. No lifecycle expectations were weakened to pass tests.

## Files in this block

1. `apps/gateway/src/controllers/bookings.controller.ts`
2. `apps/gateway/src/services/operator-booking-inbox.ts`
3. `apps/web/src/components/Header.jsx` (only new inbox integration; earlier navigation changes preserved)
4. `apps/web/src/components/OperatorBookingInbox.jsx`
5. `apps/web/src/components/OperatorInboxLink.jsx`
6. `apps/web/src/context/OperatorInboxContext.jsx`
7. `apps/web/src/main.jsx`
8. `apps/web/src/pages/Account.jsx`
9. `apps/web/src/pages/OperatorToursNew.jsx`
10. `apps/web/src/i18n/locales/en.json` (new `operator_inbox` section; earlier strings preserved)
11. `apps/web/src/i18n/locales/es.json` (same)
12. `apps/web/src/i18n/locales/fr.json` (same)
13. `libs/db/prisma/schema.prisma`
14. `libs/db/prisma/migrations/20261021000000_operator_booking_reviews/migration.sql`
15. `scripts/operator-booking-inbox.test.cjs`
16. `scripts/operator-booking-inbox-ui.test.cjs`
17. `scripts/operator-booking-inbox.postgres.test.cjs`
18. `docs/OPERATOR_BOOKING_INBOX.md`

Other pre-existing working-tree changes remain outside this block. Staging is empty.
