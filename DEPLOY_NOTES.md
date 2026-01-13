# Deploy Notes (08 Jan 2026)

## Current Mode (MVP)
- Backend runs as a single Render service (monolith operational).
- Gateway is the only public entry point.
- Active in-process modules: Pricing (ADRED-lite), Itineraries (marketplace CRUD), Payments.
- Inactive: Provider Hub, Alerts, WadAgent (no Redis required).
- Frontend is **not** in this repo; it lives in `wadatrip-web`.

## Render Blueprint
- `render.yaml` is **disabled**: see `render.yaml.disabled`.
- Manual Render service is required for now.
- Reactivate Blueprint only when returning to microservices.

## Required Commands (Monolith)
- Build: `yarn install && yarn prisma generate --schema libs/db/prisma/schema.prisma && yarn build`
- Start: `yarn start`

## Required Env Vars (Monolith)
Core:
- `DATABASE_URL=...`
- `NODE_ENV=production`

## Marketplace Itineraries (Phase 1)
- CRUD runs directly against PostgreSQL via Prisma.
- Listing defaults to `status=published`.
- Draft/publish managed by `status` field on `itineraries`.
- Payments read `price`, `currency` (USD), and `operator_stripe_account_id` from `itineraries`.
- Stripe Connect split uses `application_fee_amount` and `transfer_data.destination`.
- MVP safety: hard timeouts (1.2s) + fallbacks for `/itineraries`, `/itineraries/mine`, `POST /itineraries`.
- `POST /itineraries` returns mock payload if Prisma is unavailable.
- `/health` responds immediately (no Prisma dependency).
- TEMP: Prisma disabled for itineraries routes (DB-free), all CRUD returns mock/empty.

## Technical Status (MVP)
- Start Command: `yarn start` (monolith).
- Active: Gateway, Pricing (ADRED-lite), Itineraries CRUD (marketplace), Payments (Stripe).
- Inactive: Provider Hub, Alerts, WadAgent, Redis/queues.
- Critical endpoints must respond fast (no >1.2s DB waits).

## Future Plan (Post-MVP)
- Reactivate Provider Hub when volume justifies Redis + queues.
- Add operator verification workflows (docs/identity) in Provider Hub.
- Enable Alerts when user volume requires notifications.
- Enable WadAgent (AI assistant) only after core marketplace stabilizes.
- Reintroduce AI itinerary drafts for operators (HRM-assisted), not public auto-publish.
- Add scaling/observability once traffic grows (DB tuning, background jobs, retries).

Stripe (if enabled):
- `STRIPE_SECRET_KEY=...`
- `STRIPE_WEBHOOK_SECRET=...`

## Things to Remember
- Do **not** re-add `apps/web` to workspaces (causes duplicate workspace error).
- If services don't respond, confirm `yarn start` is used (no Redis requirement).
