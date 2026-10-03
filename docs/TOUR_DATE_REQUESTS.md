# Date inquiries and revenue readiness

A date request expresses demand for a particular public listing. It is not a
Booking, price quotation, payment authorization, inventory hold or promise that
an operator will respond. Ordinary booking remains the only path to checkout.

## Traveler and operator flow

- Tour detail: sign in, propose a future calendar day and traveler count, send.
  Requests require an active account and verified email, using existing JWT auth.
- The request and email notification are committed together in PostgreSQL.
  The browser reports **saved**, not **email delivered** or **booking confirmed**.
- Operator: List your tour → Date requests. Only the current provider owner sees
  that provider's requests. Authorized admins can see the entire operator inbox.
  A provider record without an account owner is handled by the Wadatrip team;
  it is never emailed to an unverified legacy provider address.
- Operator can decline or offer an existing real departure. Offering checks the
  canonical price, current occupancy/capacity and booking cutoff, under the same
  listing lock used for bookings. It cannot create availability or reserve spots.
- Traveler sees the response on the original tour, then selects the offered date
  in the booking calendar, accepts current terms and follows normal booking.
  Price and availability are checked again. An offer is not a price guarantee.
- Traveler can close the inquiry. That cannot cancel an actual booking or payment.

Requests are unique per traveler/listing/calendar day, including closed history;
retrying the same submission returns the same request. A changed guest count or
resubmission of a closed inquiry on that same day returns a conflict. The MVP has
no edit/reopen flow. Twenty pending inquiries per traveler and 1–100 travelers per
inquiry are abuse bounds, **not listing inventory capacity**. No automatic expiry,
chat, search-triggered emails or operator recruitment automation is added.

## State and ownership contract

`requested → available | declined | cancelled`; `available → cancelled`.
Same operator response is idempotent; a contradictory second response fails.
Every mutation locks the listing and rereads state. Creation locks the traveler
row with `FOR NO KEY UPDATE` first, then the listing, to enforce the cross-listing
inquiry bound without blocking `KEY SHARE` locks taken by booking foreign keys.
The concurrent booking/inquiry test reproduced a failure with the stronger
`FOR UPDATE` lock before this correction. No inquiry flow locks a traveler after
holding a listing lock. Ownership is derived from current
DB records and verified JWT claims; client identity and provider fields are ignored.

API projections expose request ID, listing ID/title, dates, count and status only.
No traveler email/name/phone, owner identity, verification data, payments or tokens
are returned. There are no public inquiry lists or raw free-text messages.

## Durable alerts

`tour_request_notifications` is a small outbox committed with the request/response.
Gateway polls every 60 seconds while the feature is enabled. Up to ten alerts per
batch, five attempts per alert, exponential backoff capped at one hour. Claims use
conditional PostgreSQL updates with a two-minute lease and claim token. External
email calls happen outside DB transactions, with a ten-second timeout.

The email service reuses the existing Resend/SendGrid configuration. Resend also
receives a stable notification idempotency key. Neither email provider acceptance
nor an outbox `sent` status guarantees inbox delivery. A crash after provider
acceptance but before marking `sent` can duplicate an email (especially SendGrid,
or after the processor's idempotency retention); never a booking or charge. The
private inbox remains authoritative. Retries do not modify booking/inventory.
Stale operator notices after a response/closure are skipped. Failed/exhausted alerts
remain stored for investigation; no unlimited or automatic manual replay is added.

Email recipients come from the active linked owner's user record, the requesting
traveler's active user record, or explicit `TOUR_REQUESTS_EMAIL` for unlinked tours.
No personal identity of the traveler is included in the operator email. Logs record
technical request/notification IDs, audience, result and safe error category only.

## Safe rollout (not executed against production)

1. Review the isolated additive migration `20261002000000_tour_date_requests`.
   It creates two new tables, FKs, state/count constraints and indexes. It does not
   change historical users, listings, bookings, payments or availability.
2. Confirm deployed Prisma migration history is healthy; rehearse on an authorized
   production copy if required by the release procedure. Snapshot before migration.
3. Keep `ENABLE_TOUR_DATE_REQUESTS` unset/false. Apply the approved migration using
   the explicit release migration step; never put migrations into a frontend build.
4. Deploy Gateway with the generated Prisma client and deploy the frontend.
   With the flag off, Gateway does not query the new tables and the UI is hidden.
   Older Gateway returns 404 for the public feature status; the new UI stays hidden.
5. Confirm `EMAIL_PROVIDER`, `EMAIL_FROM` and the existing provider API key work.
   Set `TOUR_REQUESTS_EMAIL` to an approved team inbox if unlinked-tour alerts are
   needed. These settings and the email provider were not changed by this block.
6. Enable `ENABLE_TOUR_DATE_REQUESTS=true` on the approved Gateway deployment.
   Use a verified pilot account to test save → private operator inbox → alert →
   real departure offer → traveler response → existing booking flow. Sending real
   notifications and creating production requests requires the release authorization.
7. Monitor failed outbox rows and request response times. Only offer real departures.
   Disable the flag to roll back behavior, keeping request history intact. Roll back
   code without dropping the new tables. Do not erase inquiries or mark emails sent.

Read-only investigation (technical IDs and safe categories only):

```sql
SELECT status, count(*) FROM tour_date_requests GROUP BY status;
SELECT status, count(*) FROM tour_request_notifications GROUP BY status;
SELECT id, request_id, audience, attempts, last_error, next_attempt_at
FROM tour_request_notifications WHERE status = 'failed' ORDER BY created_at;
```

## Validation boundaries

Current local validation: 241 core/HTTP/unit tests, 9 real disposable PostgreSQL
tests, 6 inquiry browser checks, 29 existing web-control checks and 4 existing
auth-session checks (289 total). Common, DB, Gateway, Provider Hub and frontend
builds, Prisma validate/generate and diff checks pass. The email sender is fake in
all integration tests; there is no evidence of production inquiry delivery yet.

- Local Nest HTTP and unit tests use synthetic DB/email fixtures only.
- Real disposable PostgreSQL tests exercise full migrations, an upgrade with
  synthetic legacy records, constraints/FKs, two-connection request/response
  deduplication, outbox claims, rollback and closure/response races.
- Local mobile browser tests simulate all API responses and all notifications.
  They demonstrate UI wiring, not real inbox delivery or production readiness.
- No production DB, Stripe or real email calls are part of these tests.

## What still blocks the first real sale

This captures otherwise lost demand; it does not make an incomplete tour bookable.
Close the pilot tour's deployed booking-terms date/time error, confirm real operator
ownership and availability, verify price/policy/meeting point and payout readiness,
then repeat the deployed traveler/booking/Stripe Test/webhook/status flow. Stripe
Live and production money remain a separate explicit release gate. Verified email
proves access to a mailbox; it is not identity/KYC or operational verification.
