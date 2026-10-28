# International payout review — 2026-10-14

## Update — 2026-10-27: Stripe account-specific decision

The 2026-10-14 decision below is superseded where it assumed Stripe Global Payouts
was still awaiting eligibility review. Stripe Support later confirmed in writing
that WADATRIP LLC is not currently eligible for Stripe Treasury. Because Treasury
is required for Global Payouts, Stripe cannot enable Global Payouts or support the
operator payout flow proposed in that case. Stripe also stated that no product or
account configuration was changed. This does **not** establish that ordinary
Stripe card payments are approved for Live use, and it does not change the
successful Sandbox evidence recorded elsewhere.

The support statement is account-specific evidence supplied by the owner; no
Stripe Live API call or account change was made by this review. Treat the
Stripe-managed Peru payout route as unavailable unless Stripe later changes its
eligibility decision in writing.

### dLocal evaluation gate — no selection or integration

dLocal for Platforms is the next candidate to qualify for the Peru marketplace
corridor. Public product information describes marketplace payins, seller
onboarding, split payments and local payouts, and its documentation includes Peru
payment and payout material. Public country coverage alone does not approve
WADATRIP LLC, prove that US- or EU-based travelers can pay Peruvian sellers through
our specific platform account, or confirm support for our early-stage volume.

Before implementation, obtain written confirmation and a commercial proposal for
this exact flow: US-incorporated WADATRIP LLC; traveler card charges initiated from
the US and, if supported, Europe; independently operated Peruvian guides and
Peruvian tour businesses as sellers; USD customer pricing; seller settlement to a
Peruvian bank in PEN; 15% platform commission; and refunds, disputes, cancellation
cutoff, service completion and payout timing. Ask for setup/monthly fees, minimum
volume or minimum fees, card and payout rates, FX margin, reserves, payout limits,
failed-payout recovery, idempotency/webhook behavior, and the seller KYC data
Wadatrip must collect or retain.

Do not infer that dLocal is cheaper than Stripe before comparing actual written
quotes. dLocal says it primarily serves businesses with significant current or
near-term volume and may recommend a partner or narrower market to an early-stage
business. Its Platforms solution also leaves the platform as owner of the customer
experience and does not make Wadatrip Merchant of Record; legal, tax, consumer,
refund and seller-contract responsibilities require separate review.

Primary references checked on 2026-10-27:

- [dLocal for Platforms](https://www.dlocal.com/our-solution/dlocal-for-platforms/)
- [dLocal seller onboarding documentation](https://docs.dlocal.com/docs/onboard-user-accounts-platforms)
- [dLocal FAQ: suitability, volume and pricing](https://www.dlocal.com/faqs/)
- [dLocal Platforms overview](https://docs.dlocal.com/docs/platforms-overview)

**Current decision:** keep Stripe Sandbox for technical validation; no Live charge,
no manual operator payout, no dLocal integration, and no provider selection until
written corridor eligibility, fees and responsibilities are understood. Operator
account creation and tour preparation may continue only under the existing
invitation-only, preparation-only controls.

## Code verification — 2026-10-27

The synthetic `scripts/payout-identity.test.cjs` acceptance suite currently has
**8 failing checks out of 14**. The current Stripe Connect code has no private
payout legal-country/entity/bank-country settings or matching/validation helpers.
In particular, `PaymentsController.connectLink` creates the connected account
using `provider.country_code`, which describes the provider/listing location. A
synthetic case with public location PE and claimed US legal identity therefore
requests an account in PE. The check did not contact Stripe; all processor calls
were intercepted by an in-memory fake.

This is a real readiness gap, not evidence that Stripe accepted a live payout
account: the route still uses Connect, Stripe Support has said that the proposed
Peru operator Connect corridor is unsupported for this account, and the payout
identity model is not implemented. The Live charge gate remains explicitly
disabled unless all of its runtime controls are set, but a future Live rollout
must not enable this Connect path for Peru or infer payout eligibility from the
public provider country. Do not add country-specific account creation rules or
collect legal/bank identity fields until the chosen payout provider supplies
written requirements and the data-handling obligations are reviewed.

No Stripe call, dLocal call, account configuration, migration or payout was made
during this verification. dLocal's response and corridor approval remain
pending.

The findings and decision below record research conducted on 2026-10-14. At that
time no provider had been selected or contacted and no account, code, configuration,
migration or financial operation had changed. Existing payout-identity implementation
remains paused; its new test file was preparatory and had not established a regression result.

## Decision

Retain Stripe card collection for the pilot. Obtain a marketplace-specific proposal
for the US-to-Peru payout corridor before implementing a second integration.
Prioritize existing Stripe support for launch speed; compare Wise Platform and
Airwallex Payments for Platforms for cost and coverage. dLocal for Platforms is a
regional expansion candidate. Public coverage does not establish Wadatrip approval.
There is not enough evidence to name the cheapest approved provider yet.

## Findings and limits

| Candidate | Public evidence | Unresolved before adoption |
|---|---|---|
| Existing Stripe Connect | Marketplace collection/split already implemented. Current cross-border guidance restricts self-service regions and recipient agreements. | Exact Live path for the actual payee and Peru bank; no Sandbox-to-Live inference. |
| Stripe Global Payouts | US senders can pay individual/company Peru recipients locally in PEN. Published Peru corridor permits an illustrative cost calculation. | Separate Treasury/product approval, actual payee eligibility and legal/funds-flow assessment. Not a drop-in Connect destination. |
| Wise Platform | Marketplace product, bank payouts, API/webhook tracking; public US-to-Peru USD/PEN route. | Quote for actual individual/company recipients and marketplace use, funding, minimums and onboarding. Consumer transfer calculator is not a platform quote. |
| Airwallex Payments for Platforms | Marketplace connected-account model; local PEN rail in Peru. | US platform/individual payee eligibility, minimums, platform pricing and responsibilities. Business-account advertisements are not a marketplace contract. |
| dLocal for Platforms | Marketplace/multi-party product and Peru payout documentation. | Tailored commercial terms, minimum commitments and pilot suitability. |

Global Payouts documentation describes it as best suited to businesses already holding
required money-transmission licensing. Do not assume Wadatrip needs a license or has
an exemption: obtain account-specific provider guidance and appropriate legal review.
Similarly, an ordinary business transfer account is not automatic authorization to
hold or transmit marketplace sellers' funds.

## Illustrative economics, not a quotation or net profit

Assume USD 50 per booking, Wadatrip commission 15%, operator entitlement USD 42.50
converted to PEN, Wadatrip pays all modeled fees. Standard US online card fee is
USD 1.75; international-card example USD 2.50 without card-side FX.

Global Payouts public US-to-Peru cost: USD 1.50 + 1.25% cross-border + 1% FX.

| Scenario | Payout expense | Remaining contribution per booking: US card / international card |
|---|---:|---:|
| One booking, one payout | USD 2.46 | USD 3.29 / USD 2.54 |
| Ten bookings for the same guide, one payout of USD 425 equivalent | USD 11.06 total | USD 4.64 / USD 3.89 |

Rounding is illustrative. Excludes other contracted charges, receiving-bank deductions,
taxes, disputes, refunds, operating costs and any reserves. Do not add Connect charges
to this separate modeled route without a quote showing they apply. Grouping requires
an agreed lawful payout schedule and only eligible payable balances, not arbitrary holds.

## Request for comparable proposals — prepared, not sent

WADATRIP LLC is a US tours marketplace. We collect card payments from travelers and
retain 15% commission. Individual guides and companies operate internationally, initially
Peru. Please confirm whether you support this exact marketplace flow, including an
individual legally resident in the US receiving into their own Peru bank account.

Quote USD-to-PEN and, if available, USD-to-USD Peru-bank payouts for USD 42.50,
USD 425 and USD 850; distinguish sending fees, FX margin, funding, intermediary or
recipient-bank fees, monthly minimums, setup and per-payee fees. Confirm onboarding,
fund ownership/holding responsibilities, payout schedule limits, travel restrictions,
refund/recovery after payout, idempotency, webhooks and failed-payment handling.

No signup, contract, support message or new integration is authorized by this research.

## Primary sources checked

- https://docs.stripe.com/connect/cross-border-payouts
- https://docs.stripe.com/global-payouts
- https://docs.stripe.com/global-payouts/recipient-requirements
- https://docs.stripe.com/global-payouts/pricing
- https://stripe.com/us/pricing
- https://wise.com/platform/marketplaces
- https://docs.wise.com/guides/product/account-setup
- https://wise.com/us/send-money/send-money-to-peru
- https://www.airwallex.com/docs/connected-accounts/about/connected-accounts-and-embedded-finance
- https://www.airwallex.com/docs/payouts/payout-network/bank-accounts/peru
- https://www.airwallex.com/en-us/pricing
- https://docs.dlocal.com/docs/peru-payouts-v3
- https://www.dlocal.com/faqs/
