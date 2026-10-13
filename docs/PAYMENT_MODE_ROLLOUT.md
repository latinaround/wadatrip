# Payment mode rollout: current evidence and gates

Preparation on 2026-10-13. No staging, commit, deployment, schema application or financial
repair performed. Current Render/DB checks were read-only with verified TLS; Stripe checks
were GET-only with an explicitly Test credential and verified platform identity. No Live calls.

## Current deployed state

| Item | Evidence |
|---|---|
| Gateway | Commit `4bec9649cbe4fecea46cb4de20db46b8b9ab14d6` |
| Migration history | 25 finished, zero failed; mode migration absent |
| New mode columns | All four absent; local code cannot start safely against this schema |
| Payments | Test; automation enabled; fee not explicitly configured |
| New-payment gate | Not configured/enforced in the deployed version |
| Business row counts | 71 bookings, 3 ledgers, 10 payment events, 1 availability row |
| Pending financial flows/refund jobs | 0 / 0 at inspection time |
| Events | 9 processed; 1 historical received/unprocessed |
| Historical exceptions | 54 unknown booking amounts, 69 unknown inventory states, 22 occupied days without availability, 1 unbacked confirmation, 7 NOT VALID constraints |
| Pilot | Published, verified provider, USD 50, 2026-11-30 09:30 America/Lima, 24-hour cutoff, 19/20 spots |

Zero open jobs does not eliminate the mode-classification prerequisite: cancellation of the
existing confirmed Test booking after rollout could create a new refund job. Its verified
ledger needs explicit Test mode for the new automatic worker to select it.

## External verification and proposed classification

| Technical booking | Local / verified processor evidence | Decision |
|---|---|---|
| `cmv1lzu610003lo2284x8uaqs` | confirmed/paid/held; ledger succeeded; Session/Intent Test, succeeded, 5000 USD cents, canonical associations match | Eligible for reviewed Test-mode classification only |
| `cmv45va74000blo220gst6dkg` | cancelled/refunded/released; Session/Intent Test, succeeded, 5000 USD cents; associated full refund succeeded | Eligible for reviewed Test-mode classification only |
| `cmjbseze30004flrkxog8t4ms` | Legacy confirmed/paid, booking amount unknown, ledger expected 12000 USD cents; Session GET returns 404 with the current Test account | NEEDS INVESTIGATION; no mode/status/amount repair |

The 404 can indicate another sandbox/account or an unavailable reference. It is not proof
of no charge, no customer obligation, or a valid Live reference. Do not probe Live without
explicit authorization, reset the pending event, or reconstruct the booking amount.

A narrowly generated repair is available privately under ignored logs for review. It has
not been executed. It selects exactly the two verified ledgers, locks the pilot listing using
the shared protocol, checks current associations/amounts/currency/status/inventory, then
sets only NULL `PaymentRecord.processor_mode` to `test`. Unknown legacy data is excluded.
Preconditions fail atomically if either record changed. Refresh Test verification before approval.
Do not expose the repair as an automatic build, migration or startup operation.

The exact generated SQL was then executed against a **new isolated PostgreSQL 17 clone**
with explicit synthetic fixtures for those two target rows. It classified exactly two rows,
left the legacy NULL mode unchanged, preserved fingerprints of all other payment columns
and all Booking/Inventory/PaymentEvent data, and passed a second idempotent execution.
Changing one expected booking amount made the guard reject the entire repair with zero
partial mode updates. This proves the SQL contract, not authorization to run it in production.

Docker Desktop became unavailable during this local check and was restarted with permission.
The disposable template was restored again from the existing authorized encrypted backup.
An additional harness failure handling empty psql stdout was corrected in ignored local
test tooling; it did not require an application change. Failed attempts were preserved.

## Exact rollout sequence, after review and explicit authorization

1. Review the scoped code/migration/report diff and create a clean commit, preserving unrelated
   working-tree changes. Verify the release artifact contains that commit only.
2. Obtain a fresh authorized encrypted backup and current read-only preflight. Restore/rehearse
   the 25-to-26 upgrade on a new isolated copy, not only the September historical backup.
3. Refresh external Test verification and review the exact two-row classification SQL. Leave
   the legacy 404 case and old unfinished event unchanged, with an investigation owner.
4. Enter a controlled maintenance window: stop old payment/booking writers and workers,
   drain transactions, and ensure unavailable webhook delivery gets a retryable error rather
   than a fabricated acknowledgement. Do not change Stripe keys.
5. Apply only `20261014000000_payment_mode_isolation`, then the separately approved reviewed
   classification. Validate 26 finished migrations, four new columns, all mode constraints/indexes,
   original business values/history intact, and exactly two known Test ledgers, one unknown.
   Run `payment-postflight.sql` and `payment-mode-readiness.sql`; refresh expected counts.
6. Start the compatible Gateway with Test credentials. Keep Live disabled, old writers stopped
   and new Checkout closed initially. Verify signatures, auth/ownership and existing-payment
   recovery; confirm automatic recovery can see the explicitly classified Test records.
7. Permit new Test Checkout, then run a new traveler booking through hosted Checkout and
   close the browser after payment. Confirm permanent signed webhook, deduplication, ledger,
   confirmed booking, held inventory, notifications and account/operator displays.
8. Separately resolve operator legal domicile, payout eligibility, commission/fees, Live webhook,
   Live account association and Test history treatment. Enabling Live is not part of this rollout.

Do not hardcode a fee agreement as though the operator accepted it. Test currently defaults
to 15%; Live requires an explicitly approved percentage and validated configuration. Existing
account/admin financial totals can include Test history: review their treatment before Live;
this block does not redesign Account or financial dashboards.

## Stop conditions and recovery

- Changed/unverified target, failed migration/history, unavailable restorable backup, mismatched
  record association, wrong processor mode, unresolved jobs or unknown live-money liability:
  keep payments closed and investigate; do not force a migration resolve or clear references.
- New columns missing, old writer still active, constraints/indexes missing, price/capacity/auth
  smoke failure or webhook acknowledged without processing: do not reopen Checkout.
- A successful schema addition alone is not permission to roll back to old financial writers.
  Keep the additive schema and compatible recovery path; prefer a reviewed forward fix.
- After any new external outcome, never restore an older database snapshot blindly: that could
  discard payments. Correlate booking/ledger/event and reconcile under the existing lifecycle.

## Pilot funds flow confirmed; legal details still required

### Global host model clarified by the founder

Wadatrip must accept individual hosts and businesses in multiple countries. Kiara is the
pilot guide; being a guide does not itself determine the legal payee type. Longer-term supply
also includes accommodation hosts. Accommodation booking/inventory is not implemented by
this payment-mode block and must not be presented as ready.

Keep three independent decisions:

- Service: guide/tour operator, or a future accommodation host.
- Legal payee: individual or business, with its actual legal country.
- Readiness: account ownership/contact verification, Wadatrip service approval, and processor
  identity/payout verification. Email possession and processor KYC do not certify service quality.

Reuse hosted processor onboarding to collect sensitive verification/banking requirements
appropriate to country and legal business type; do not build a second document/KYC system.
Stripe-hosted forms adapt to country, capabilities and business type, but supported payout
routes still depend on the platform account/product configuration.
[Hosted onboarding](https://docs.stripe.com/connect/hosted-onboarding),
[required verification information](https://docs.stripe.com/connect/required-verification-information).

Current code limits: provider `type` is a marketplace role, not a legal business type. Connect
creation currently derives country from provider `country_code` (also used by the public base
location) and the helper unconditionally chooses `recipient`. Neither is a sufficient global
onboarding contract. Before extending Live, collect legal country separately from tour/base
location, verify permitted country/product/funds-flow combinations, and never auto-create a
US/PE account from a phone number or destination. The correct agreement/capabilities must
follow that verified route; do not change an already accepted account agreement in place.

Small next milestone: authenticated host chooses individual/business and legal country;
backend validates an approved payout route, binds the connected account to the actor-owned
provider, and existing hosted onboarding performs financial verification. Enable bookings
only after independent service approval and current processor readiness. Reuse the existing
booking/price/inventory/payment core, launch supported pilot countries first, and add country
coverage only with verified eligibility. This is a plan, not code implemented in this turn.

On 2026-10-13 the founder confirmed: Wadatrip collects the traveler payment first;
Kiara is the pilot operator and receives the operator share, while Wadatrip retains its
agreed commission. This confirms the marketplace collection model, not the fee percentage,
legal payee type, tax domicile or bank payout timing. The current destination-charge flow
does not implement a hold until the tour is completed; connected balance transfer and bank
payout are distinct operations. No Stripe configuration or production data changed here.

Confirm whether Kiara receives funds individually or through a business, and the real legal
domicile of that payee. A phone number, tour location or platform LLC address does not
establish the operator's country. Then confirm with Stripe that the
exact proposed country/account/funds flow is eligible in Live. The support question is prepared
in [the rehearsal report](PAYMENT_MODE_REHEARSAL.md); no message has been sent.
