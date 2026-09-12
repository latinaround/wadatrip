# WadaTrip Platform Architecture

This document is the operational source of truth for the platform repo.

## Active Surfaces

### Backend / API
- Repo: `wadatrip-platform`
- Runtime: Render
- Public base URL: `https://wadatrip.onrender.com`
- Core responsibility:
  - gateway
  - bookings
  - provider/listings
  - pricing
  - itineraries
  - WadaAgent

### Public web
- Repo path: `apps/web`
- Runtime: Vercel
- Public URL: `https://www.wadatrip.com`
- Current source of truth for the live website:
  - `apps/web`

## Vercel Configuration That Should Stay True

- Root Directory: `apps/web`
- Build Command: `yarn build`
- Output Directory: `dist`
- Development Command: `yarn dev`

If this changes, update this file the same day.

## Legacy Paths

### `vercel-static/`
- Status: legacy
- Purpose: old static snapshot / fallback reference
- Not the active source of truth for the public website
- Do not ship new web features here unless the deployment strategy is intentionally reverted

### `wadatrip-web`
- Status: legacy / historical standalone frontend
- Purpose: previous or parallel web workspace kept for reference
- Not the active source of truth for the public website
- Do not assume commits there affect production unless Vercel ownership is explicitly migrated

## Product Model

### Payment boundary (decision: 2026-09-10)

Stripe is the MVP payment processor. Keep the existing integration; do not add another
processor or a payment framework during revenue P0. Fees, country coverage and volume
may justify evaluating alternatives later.

Listing price/currency, participants, calculated total and booking status belong to
Wadatrip's domain. The backend calculates and persists the total before payment.
The payment layer receives that total and currency, then calls Stripe; it owns processor
constraints, external session/payment IDs, payment status and charged amounts.
Neither browser input nor Stripe determines the marketplace price.

Current coupling: gateway payments and webhooks use Stripe directly; booking reads also
use Stripe to enrich checkout/receipt links. DB fields include providers.stripe_account_id,
itineraries.operator_stripe_account_id, bookings.checkout_session_id/payment_intent_id,
and PaymentRecord.stripe_payment_intent_id/stripe_checkout_session_id.
PaymentRecord.provider_id denotes the marketplace operator, not a payment processor.
A future multi-processor change would need an explicit processor discriminator and
external references. No schema change is required for P0 server-authoritative pricing.

The initial pricing fix corroborates stored booking totals against the current listing
before payment because older totals were client-controlled. A changed listing price
blocks payment of a mismatched booking; immutable, versioned price snapshots are deferred.

### Marketplace

Revenue P0 availability uses the existing `listing_availability` model. The web submits
a UTC calendar date and `num_people`; there is no time-slot selector or listing timezone.
Exactly one availability row per listing/day is required. Empty or ambiguous days cannot
be booked. No availability is fabricated: browsing remains open, but operators must supply
real dated capacity before their listings can receive bookings/payments.

`spots_total` is canonical capacity. Remaining seats are derived from bookings for that
UTC day; `spots_available` is a refreshed cache, never a client-controlled limit.
Booking.inventory_state explicitly records held/released allocation. Historical null
allocation uses a conservative status fallback; financial review never implies release.
Pending seats do not expire
automatically in this block. Listing start/end dates are inclusive day boundaries.

Gateway and Provider Hub use the same PostgreSQL listing-row lock inside a Read Committed
transaction before reading occupancy and creating/changing bookings. Creation, cancellation
and reactivation (including payment webhooks) follow this lock order. No network requests
occur inside the transaction. External/admin inventory writers must respect this protocol.

Payment initiation atomically persists one immutable PaymentRecord and changes the booking
to payment_pending before external IO. Cancellation first becomes cancellation_pending and
retains inventory until processor termination is verified. PaymentEvent receipt is durable
before processor lookup; only processed_at denotes completion. Event completion,
financial settlement and inventory transitions commit together under event/listing locks.
Late money is recorded even when confirmation is impossible: reconciliation_required /
refund_required replaces false confirmation. See [payment lifecycle](PAYMENT_LIFECYCLE.md).

Validation includes concurrent transaction simulations. A real PostgreSQL concurrency run
was unavailable locally: the installed server lacks postgres.bki and Docker is not running.
Repeat a real DB concurrency test before production release; simulated locks do not validate
the database engine or operational configuration.

- Experience first
- Host comparison second
- Booking third

This is the core WadaTrip decision.

Travelers should:
1. discover one experience
2. compare verified hosts
3. reserve cleanly

### Media
- one destination/experience cover where possible
- one guide/operator identity block
- avoid repeated low-quality images per host

### Guide identity layer
Guides should eventually have:
- profile photo
- short bio
- trust signals
- published tours
- their own future guide agent

## Existing Data Contract

Backend already supports:
- `providers.photo_url`
- `providers.bio_short`
- `listings.cover_image_url`
- `destination_covers`

That is the correct base for guide identity and experience-first media.

## Scaling Recommendation

### Keep this repo responsible for:
- backend services
- db schema
- shared contracts
- public web frontend

### Keep mobile separate in:
- `wadatrip-mobile`

### Avoid
- multiple competing web sources
- duplicate frontend repos with unclear ownership
- changing Vercel root without documenting it

## Rule For Future Changes

If someone asks “where does the live web come from?”, the answer should be:
- `wadatrip-platform/apps/web`

If that is no longer true, update:
1. this file
2. deploy notes
3. vercel-static legacy note
4. any onboarding README
