# Operator booking alerts — release evidence

Published after explicit user authorization on 2026-10-20. This supersedes the preparation-time deployment status in `OPERATOR_BOOKING_INBOX.md`.

## Deployed versions

- Commit: `c30b2dfa04e48f5e964358bcf20df155b617232f` — `feat(operator): add persistent booking alerts`.
- Exactly 18 files in the release commit, prepared in an isolated checkout. The primary checkout, its existing changes and its index were preserved.
- Published Git tag: `operator-inbox-20261020-c30b2df`. Remote `main` remains `f68f88b66b53b79a90f11d3e424271612ed249ec`; no main push or automatic frontend replacement.
- Render deployment: `dep-dbbutflpkucs73bokdfg`, live at the exact release commit. Service configuration and environment digest unchanged. Auto-deploy remains off; no automatic migration was introduced.
- Vercel deployment: `dpl_HN55dUcPWjGnQP3Cjm5SW9sKgNH4`, READY and promoted after backend smoke checks.
- Web release: `operator-inbox-20261020-d1aa147347ba`; source hash `d1aa147347ba` is the abbreviated overlay manifest hash (the full hash is retained in the local release manifest/state).
- Public domains verified: `https://www.wadatrip.com` and `https://wadatrip.com`.
- Public entry: `/assets/index-COwdjsEE.js`; operator chunk: `OperatorToursNew-D6ZcS15F.js`.
- The frontend candidate preserved the 10 earlier published UI overlays and integrated the 10 frontend files in this feature, with overlap resulting in 16 explicit overlay files. Existing destination search, company/contact navigation and traveler routes were retained. No unrelated pending backend/package edits were included.

## Migration and data protection

- Fresh read-only PostgreSQL 17 backup encrypted with Windows DPAPI and a private directory ACL; decrypt/restore verified in a new isolated local copy with no published ports.
- Exact committed migration rehearsed using Prisma 6.19.1 against that copy: 26 pre-existing business tables and 26 complete original migration records unchanged.
- The two already documented mixed-line-ending historical files were verified against the original local bytes matching the DB checksum and against equivalent committed SQL after line-ending normalization. No stored checksum, old migration or business record was edited to bypass history validation.
- Only `20261021000000_operator_booking_reviews` applied in production. Duration approximately 6.1 seconds. There are 27 finished migrations, zero failed migrations.
- New table verified empty, with one composite primary key, two validated foreign keys and two indexes including the primary key index.
- Full aggregate fingerprints of all 26 existing business tables matched before/after the production migration and after both deployments.
- Final read-only counts at `2026-10-20T22:47:39Z`: 74 bookings, 6 PaymentRecords, 25 PaymentEvents, 1 availability row, 0 operator review receipts.
- Pilot capacity remains 12 total / 8 available on 2026-11-30. No reservation, payment, inventory or historical value was changed by this release.
- Application rollback can retain the additive table and receipts. Do not drop it, restore an old database over newer transactions, or resolve migration history automatically as an improvised rollback.

## Verification and limits

- Clean Linux immutable install, Prisma generation and common/DB/Provider Hub/Gateway builds passed from the exact commit with a dummy datasource and no production credentials or migration execution.
- Previously completed feature/regression verification: 272 passing checks, including 7 real PostgreSQL 17 checks.
- Deployed HTTPS: health 200; inbox GET anonymous 401; review POST anonymous 401; bookings anonymous 401; unsigned webhook 401; authorized-origin CORS preflight 204.
- Both public domains serve the new inbox code; account, traveler trips, tours, company and contact routes return 200.
- Stripe remains Test with Live disabled. This release made zero Stripe API calls, valid booking creations, review receipts or email sends. DNS, mobile and payout configuration were not changed.
- No user JWT was forged or extracted to impersonate an operator. Positive authenticated browser acceptance remains for the owner to perform with their real session.
- Expected initial pilot inbox: **Sandbox 4**, real-reservation alerts 0, unverified alerts 0. Existing confirmed reservations begin unreviewed.

## Owner acceptance

1. Sign in as Kiara and reload the operator workspace with a fresh page load.
2. Open Bookings from the new dashboard alert. Locate the four Sandbox reservations.
3. Mark one reservation reviewed. Only its alert disappears and the Sandbox count becomes 3; the underlying reservation remains in the booking list.
4. Reload or use another signed-in device and refresh alerts. The review remains recorded by the server.
5. Do not make another payment to test the alert. Do not activate Live as part of this acceptance check.

Sensitive backup paths, credentials, tokens, PII and raw processor payloads are intentionally absent from this document. Local release state and encrypted recovery artifacts remain excluded from Git and deployment packages.

## Authorized Sandbox cleanup — 2026-10-20

The owner explicitly authorized cancelling/refunding only the three older Test reservations, preserving the latest reservation and the prior completed refund.

- Cancelled and refunded: `cmv1lzu610003lo2284x8uaqs` (Oct 9), `cmv8dgs9k0001n32kazm5rhv3` (Oct 14), `cmvbdugqz0001ma2ksf2xret8` (Oct 16).
- Kept confirmed/paid/held without changes: `cmvh7cgxc0003mj2kgtkkve70` (Oct 20), departure Nov 30 at 11:00 America/Lima.
- The previous refunded/cancelled booking `cmv45va74000blo220gst6dkg` was unchanged.
- Before any cancellation, read-only Stripe Test checks verified the platform, exact booking/ledger/session/intent associations, canonical USD 50 amounts, accepted future cancellation deadlines, and absence of any prior refund for all three targets.
- A bounded, explicitly authorized administrative maintenance task invoked the existing `cancelPolicyBooking` domain function for those three IDs. It did not forge a JWT, impersonate a browser login, add an auth bypass, or manually overwrite financial states. The existing deployed Test-mode refund worker completed the refund workflow.
- Each USD 50 Test refund was subsequently verified as succeeded through Stripe GET and the persisted refunded/cancelled/released booking/payment state. Total refunded in Sandbox: USD 150; no Live funds used.
- Final read-only checks: 1 active confirmed reservation, 1 unread Sandbox alert, capacity unchanged at 12 total with 11 available. The three historical rows remain preserved as cancelled/refunded.
- Six standard cancellation outbox messages were recorded sent by the existing notification worker. This is send evidence, not recipient-open evidence.
- No product code change, commit, deployment, DNS/configuration change or mobile modification was needed for this cleanup.

These counts supersede the pre-cleanup four-alert / eight-available baseline above. A later explicit review can reduce the unread-alert count without changing the active booking count.
