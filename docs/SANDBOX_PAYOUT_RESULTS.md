# Sandbox payout trace — pilot

Verified 2026-10-15 02:58 UTC (2026-10-14 America/Los_Angeles).

This is read-only verification of an existing Stripe Sandbox payment and automatic
payout, not a newly initiated payout or a real bank receipt. No financial writes,
new bookings, charges, refunds, transfers or payouts were requested during inspection.
All Stripe requests used the existing guarded Test credential and GET methods.
PostgreSQL queries ran READ ONLY. No customer data or bank credentials are included.

## Correlation

| Stage | Evidence |
|---|---|
| Booking | cmv8dgs9k0001n32kazm5rhv3 — confirmed / paid, canonical USD 50 |
| PaymentRecord | f1cc82fe-47ac-47d3-9212-0f87bb3da507 — Test |
| Intent | pi_3UQW5BAHNOOTJQKY1Ongg6Mr — succeeded; booking/payment metadata matched |
| Charge | ch_3UQW5BAHNOOTJQKY1pJnwW6y — Test; application fee USD 7.50 |
| Transfer | tr_3UQW5BAHNOOTJQKY1CPbjA7y — USD 50 gross to the associated connected account |
| Connected payment | py_1UQW5EAUfQJ8Gr2GmwFm8Ex8 |
| Connected balance transaction | txn_1UQW5FAUfQJ8Gr2G7qh7QsBW — gross PEN 172.01, recorded deductions PEN 27.52, net PEN 144.49 |
| Automatic payout | po_1UQdjsAUfQJ8Gr2GmaCJWmVV — Test, paid, PEN 144.49 |

The automatic payout's balance-transaction listing contains that exact connected
payment/transaction pair, with pagination exhausted. Destination matches the verified
Stripe synthetic test bank. The connected account is configured as individual, PE,
default currency PEN, transfers active and payouts enabled in Sandbox.

The USD 50 transfer is gross; the application fee is handled separately by destination
charge mechanics. Do not describe it as an extra USD 50 payment to the guide. The
PEN deductions above are the processor's composite Test accounting, not an independent
calculation of fees or an approved Live price. Later invoiced costs may not appear here.

## Timing and limits

- Payout creation: 2026-10-15 01:45:48 UTC. Reported arrival date: 2026-10-16 UTC.
- Status was already paid when inspected, reflecting Sandbox simulation. This does
  not establish real-world bank processing time or delivery to a person.
- A second older automatic Test payout was present but did not contain this booking's
  transaction. It was not counted as a second payment for this booking.
- The connected available and pending PEN balances were zero at inspection.
- No success-page/browser-closed experiment was performed in this inspection.

## Production gates remain

1. Current automatic bank payout happened before the November 30 pilot tour. A weekly
   performed-service settlement rule is proposed but NOT implemented or validated.
   Payout scheduling and safe holds must be agreed with the selected provider before Live.
2. This tests an individual PE account with a synthetic PE bank, not verified legal
   onboarding of Kiara as a US resident with a real Peru bank account.
3. Read-only Stripe US country-spec evidence did not list Peru as a supported bank
   country for a US account. This is distinct from supported international transfer
   destinations; never substitute the tour country as legal country to bypass it.
4. Exact marketplace eligibility, bank ownership, applicable fees, contracting identity
   and operational readiness still require evidence. Sandbox capabilities can be less
   restrictive than Live, so this result does not authorize real payouts.

Operational inspection script/output remain under ignored logs, with no secrets,
raw customer payloads or real bank details persisted. No code/schema/configuration
change, stage, commit or deployment was performed for this check.

Reference: [Stripe testing](https://docs.stripe.com/connect/testing),
[payout object](https://docs.stripe.com/api/payouts/object).

## Peru independent-guide scenario requested by owner

Rechecked 2026-10-15 04:11 UTC through the same read-only inspection. The owner
requested a hypothetical Peru-based independent guide to represent the initial
Peru supplier cohort. Reused the existing PE individual Sandbox account rather
than creating duplicate accounts or modifying Kiara's real legal-country declaration.

- The existing booking, payment, fee, transfer and automatic payout associations
  above still match. Booking remains confirmed/paid, USD 50; application fee USD 7.50.
- The synthetic PE bank receives PEN in this setup. The matching simulated payout
  remains paid for PEN 144.49. This is neither a Live fee quote nor a real receipt.
- The bank object's status is `new`; the synthetic fixture and successful Sandbox
  payout do not constitute real bank-account ownership verification or completed KYC.
- Both available and pending connected balances are zero. No new bookings, charges,
  transfers, payouts, refunds or account mutations were initiated during this recheck.
- Public USD pricing and a PEN bank settlement are distinct. No USD bank settlement
  in Peru was tested or promised. Real Peru eligibility remains subject to approval
  of the actual platform/recipient/funds-flow combination.
- Existing automatic pre-service payout behavior remains unchanged. The proposed
  weekly post-service settlement rule is still a separate, unimplemented Live gate.

## USD to PEN exchange-rate and fee breakdown

Read-only follow-up: 2026-10-15 17:06 UTC. Retrieved the exact connected balance
transaction above, verified its source association, and reconciled the recorded
gross amount, fee details and net amount. No financial writes were made.

| Field | Observed Sandbox value |
|---|---|
| Source transfer | USD 50.00 |
| Processor `exchange_rate` | 3.4401 PEN per USD |
| Converted gross | PEN 172.01, rounded from PEN 172.005 |
| `application_fee` | PEN 25.80; platform fee was USD 7.50 |
| `stripe_fee` | PEN 1.72 |
| Total deductions | PEN 27.52 |
| Net connected balance / matching paid payout | PEN 144.49 |

The rounded gross ratio (172.01 / 50 = 3.4402) is not the processor's exchange-rate
field. Use 3.4401 when reporting the rate for this transaction. Gross minus both
fee entries equals the net exactly; do not subtract the 15% platform fee a second time.
In particular, PEN 27.52 is not all Stripe fees: PEN 25.80 is the application fee.

The `stripe_fee` type alone does not identify whether that PEN 1.72 is FX,
cross-border or another pricing component. Do not publish an inferred Live tariff
or claim this captures every platform/invoiced/recipient-bank cost. USD 7.50 is
commission before the platform's own costs, not confirmed net profit.

This historical Sandbox rate is neither today's executable FX quote nor guaranteed
Live pricing. No USD-bank payout in Peru was tested. Settlement timing, permitted
route and real fee allocation still require approval before real sales.

Reference: [Balance transaction exchange rate and fee details](https://docs.stripe.com/api/balance_transactions/object).
