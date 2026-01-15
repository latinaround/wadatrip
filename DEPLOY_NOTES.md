# Deploy Notes (08 Jan 2026)

## Current Mode (MVP)
- Backend runs as a single Render service (monolith operational).
- Gateway is the only public entry point.
- Active in-process modules: Pricing (ADRED-lite), Itineraries (marketplace CRUD), Payments.
- Inactive: Provider Hub, Alerts, WadAgent (no Redis required).
- Frontend static snapshot is in `vercel-static/` (source: current wadatrip.com build).

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
- `JWT_SECRET=...` (required for `/auth/*` endpoints)

## Marketplace Itineraries (Phase 1)
- CRUD runs directly against PostgreSQL via Prisma.
- Listing defaults to `status=published`.
- Draft/publish managed by `status` field on `itineraries`.
- Payments read `price`, `currency` (USD), and `operator_stripe_account_id` from `itineraries`.
- Stripe Connect split uses `application_fee_amount` and `transfer_data.destination`.
- MVP safety: hard timeouts (1.2s) + fallbacks for `/itineraries`, `/itineraries/mine`, `POST /itineraries`.
- `POST /itineraries` returns mock payload if Prisma is unavailable.
- `/health` responds immediately (no Prisma dependency).
- Prisma-enabled itineraries CRUD with timeouts + fallback only on error.

## Technical Status (MVP)
- Start Command: `yarn start` (monolith).
- Active: Gateway, Pricing (ADRED-lite), Itineraries CRUD (marketplace), Payments (Stripe).
- Inactive: Provider Hub, Alerts, WadAgent, Redis/queues.
- Critical endpoints must respond fast (no >1.2s DB waits).
 - Vercel config for 1:1 frontend match:
   - Root Directory: `vercel-static`
   - Build Command: (empty)
   - Output Directory: `.`
- Gateway now provides Provider-Hub-compatible endpoints in-process:
  - `/providers`, `/providers/:id`, `/providers/:id/verify`, `/providers/:id/verification-status`, `/providers/:id/resubmit`
  - `/listings`, `/listings/search`, `/listings/:id`, `/listings/:id/status`
  - `/bookings`, `/bookings/simple`, `/bookings/:id`, `/bookings/:id/status`
  - `/alerts/tours/create`, `/alerts/tours/list`, `/alerts/list`
  - `/auth/register`, `/auth/login`, `/auth/me`, `/auth/update`

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

## Local Changes Pending (14 Jan 2026)
- Gateway health now responds fast at `/health` with `{ status: "ok" }` (both controller and Express shortcut).
- Gateway webhooks send `payment_status` and include `x-internal-service-token` when updating bookings.
- Gateway proxies for `/alerts`, `/providers`, `/wadagent` now gated by env flags: `ENABLE_ALERTS_PROXY`, `ENABLE_PROVIDER_HUB_PROXY`, `ENABLE_WADAGENT_PROXY`.
- Provider Hub bookings endpoints now require `INTERNAL_SERVICE_TOKEN` (header `x-internal-service-token`) to create/update bookings.
- Provider Hub verification now maps `verified` to `approved` and updates `verification_status` + `status` accordingly.
- Health endpoints simplified to `{ status: "ok" }` for gateway, itineraries, provider-hub.
- `Dockerfile` stops building `service-alerts` and runs gateway from `apps/gateway/dist/main.js`.
- `.env.example` adds WadaAgent vars and `WADAGENT_URL`.
- `libs/common/src/index.ts` now re-exports `metrics` and `redis`; `libs/common/src/dtos.ts` was replaced by `export * from "./dtos"` (check for self-import conflict).

Untracked additions:
- `libs/db/prisma/migrations/20260106133000_add_agent_itineraries/` adds agent ownership fields + scenario metadata.
- `services/itineraries/src/itineraries.module.ts` and `services/pricing/src/pricing.module.ts` add Nest modules.
- `src/components/HeroVisual.jsx` adds hero UI with embedded WadaAgent.
- `.dockerignore`, `baseline.sql`, `apps/web/.yarn/` (local tooling artifacts).
