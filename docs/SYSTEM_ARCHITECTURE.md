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
