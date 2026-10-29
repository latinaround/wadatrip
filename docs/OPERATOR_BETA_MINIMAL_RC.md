# Operator Beta operational release — 29 October 2026

## Current authority and scope

The owner authorized implementation, scoped cleanup, commits, branch publication,
protected production backup/restore rehearsal and coordinated Render/Vercel
deployment. This supersedes the historical approval language below. External
admission, new spending, domain/mail changes, data deletion and Live payments
remain outside that authority. Keep both operator allowlists empty for acceptance.

The earlier source has 58 actual differences; two unchanged paths were
unnecessarily declared. The operational manifest declares actual differences.
Additional fixes close publication for administrators during preparation,
check actual native Node/Prisma/database readiness at production startup and
support explicitly verified proxy handling for persistent OTP quotas. Dependency
versions/lockfiles stay unchanged. No Community application, mobile or new AI
feature is introduced. Preserve all 29 applied migrations, including Community.

Original source/index/refs/worktrees are protected by a pre-operation SHA-256
snapshot. Build, packaging and isolated Git checkout are separate from source.
Manifest, exact file list and deployment evidence are outside deployable source.
No secrets, backup, installation state or generated output may enter Git.

Follow-up revision: controller-level regression reproduced a bypass on the
Gateway draft status route despite the shared publication guard. The route now
checks publication for every actor before any status write. Preparation access
capabilities also report can_publish=false for administrators. Two additional
tests exercise a real synthetic session-bound MFA proof, both Gateway/Hub entry
points, draft creation and status mutation without a database write.

## Operational configuration

Render: NODE_VERSION=24.22.1; preparation-only=true; cohort cap=5; both member
and publication lists empty; new payments/live=false; document uploads, leads,
lead search, leads proxy, WadaAgent proxy, Community and Provider Hub routing all
explicitly false. Preserve independent stable AUTH_RATE_LIMIT_SECRET and
INTERNAL_SERVICE_TOKEN (at least 32 characters), JWT, email and Test Stripe
configuration. Startup validates these gates and executes a bounded read-only
Prisma transaction checking prerequisite tables and unfinished migrations. Its
safe log reports actual Node/Prisma versions, database major and Render commit.
Build, predeploy and startup run no migrations. Keep financial recovery/webhooks
available; do not enable global maintenance.

Vercel Production: VITE_API_BASE_URL=https://wadatrip.onrender.com,
VITE_WADAAGENT_ENABLED=false, VITE_ADMIN_DEV_BYPASS=false. Use real production
variables for deployment, never the synthetic localhost build. Keep www and the
existing apex redirect. The absent api.wadatrip.com DNS entry is independent.

AUTH_TRUSTED_PROXY_HOPS=0 defaults to the verified socket peer. It cannot trust
forged forwarding prefixes, but can share a proxy bucket across users. Nonzero
depth requires Render built-in runtime identifiers, a private app socket peer
and observation of the actual right-counted forwarding chain. Never enable
blanket Express trust or accept the arbitrary first X-Forwarded-For address.
Temporarily AUTH_PROXY_DIAGNOSTICS=true allows at most six labelled GET /health
diagnostics per process. Only chain depth and keyed candidate fingerprints are
logged; no raw address, mail, contents or secret. Compare baseline against one
and two malicious left prefixes; choose the baseline depth only if that entry
remains stable and represents the client boundary. Disable diagnostics afterward.
If inconclusive, keep depth zero and external admission blocked. Do not raise
quotas to conceal shared proxy buckets.

## Backup and exact rollback references

Take PostgreSQL 17 custom pg_dump via verified TLS and a bounded read-only
connection. Encrypt in memory with DPAPI CurrentUser into an owner-only directory
outside Git. Encrypt complete rollback configuration there too. Decrypt/checksum,
then restore into cached PostgreSQL 17 on an internal Docker network with no host
ports or volumes, tmpfs only. Check all 29 migration records, schema contracts,
table counts and transaction rollback; preserve historical CRLF/LF evidence.
No production migration is pending. A changed migration set closes deployment
until its exact delta is inspected/rehearsed; never reset, db push or resolve.

Pre-release backend: commit c3031e9ca83cd1393cf43d6c9f9b3b95872daf8a,
deployment dep-dbh92tqfngtc73avk5dg. Pre-release frontend:
dpl_HLYSJYVi6Xj67mVLsvbXBwyNrrmZ. Re-read these before deployment. Roll back
the exact deployment, or explicitly deploy that backend commit and promote that
frontend ID in the same project. Keep all admission/publication/payment gates
closed. Recheck www/apex, bundle API target and protected routes. Do not restore
a database over newer activity as application rollback: that requires a separate
incident decision and approval. DPAPI recovery requires the same Windows user/
profile; the local rehearsal does not establish offsite recoverability.

## Deployment and acceptance

Verify staged bytes against the source manifest and staged whitespace/credentials
before committing only the isolated branch. Record its remote immutable commit.
Keep auto-deploy off. Deploy Render by exact commit; inspect live status and native
runtime probe, then HTTP/CORS/gates and read-only DB checks. Prepare Vercel with
production variables and --skip-domain; inspect packaging/build before promotion.
No further owner approval is needed for these already authorized steps.

Local tests cover security/session/MFA/admin boundaries, immutable installation,
Prisma validation/generation, backend/web builds, real synthetic PostgreSQL full
migration/concurrency/HTTP/inbox, browser sessions/inbox and financial recovery.
Preserve failed attempts and corrected reruns; count distinct final cases only.
Production checks include health/catalog 200; protected anonymous routes 401;
unsigned webhook 401; Community handlers unavailable; www CORS allowed and
untrusted origins without allow-origin. Check the actual public bundle/API target.

Positive enrolled operator draft/availability and wrong-owner tests use isolated
synthetic accounts while both live allowlists remain empty. Their production
equivalents stay pending until separately approved enrollment. Do not temporarily
enroll test users or fabricate production JWTs. Register/verify/login/logout mail
acceptance uses only an exact owner address explicitly confirmed for test sends.
Administrative MFA requires the owner's normal session/authenticator completed
personally. Never collect codes, tokens or stored MFA seeds to impersonate users.

The web media adapter has no Firebase Storage writer and unconditionally rejects
device uploads; backend document guards reject before Multer. Today's console
again showed Storage Get started for wadatrip-nuevo, with no bucket/rules visible.
No VITE_FIREBASE_STORAGE_BUCKET production override exists. This does not prove
absence of every Google Cloud bucket. Do not provision Storage or enable document
uploads. The historical Firestore Community pause was previously published and
verified; do not reopen it or ship the old mobile path.

JWT stays in localStorage: same-origin XSS can steal it. Logout clears the client
session, without server token revocation. These session fixes do not change that.

## First operator admission procedure (requires separately named approval)

1. Finish deployed acceptance, confirmed owner mail/login and normal admin MFA.
   Owner identifies legitimate business/contact, legal establishment and proposed
   destination. Peru is the pilot, never an inferred legal/payee identity.
2. Owner selects support contact, consent/privacy wording, retention and withdrawal
   procedure. Invite only the specifically approved recipient, manually. Collect
   no identity/bank documents and promise no public publication or sales.
3. Operator registers at /guides/signup and verifies email. Admin confirms exact
   user ID and business; separately enrolls that ID in OPERATOR_BETA_USER_IDS
   (maximum five). Publication list stays empty, preparation/payment gates closed.
   Redeploy/re-read effective configuration through the reviewed procedure.
4. Operator completes /operator and saves owned drafts at /operator/tours/new:
   accurate description, destination/IANA zone, guide languages, USD pilot price,
   local departure date/time, capacity and service/cancellation conditions. Use
   manually reviewed public photo URLs, no document uploads.
5. Verify own draft/availability edits, wrong-owner denial and rejection of public
   publication, free/paid reservations and new checkout. Record operational feedback.
   Revocation removes the ID and redeploys; next mutation fails, drafts preserved.

Proposed consent for owner review, not legal approval: “I understand this is a
private preparation beta. My tours will not be publicly published or bookable.
Wadatrip may use my submitted information to prepare/review listings and contact
me about the beta. I confirm permission to share these materials.” Attach the
actual privacy notice/support/retention/withdrawal details selected by the owner.
Model training consent must be separate; no training/fine-tuning is enabled.

## Piensa hosting cancellation preparation (not executed)

Observed app routes use Vercel frontend and Render backend/PostgreSQL. Piensa
remains authoritative DNS and incoming mail routing; no Piensa-hosted app was
found on www/apex. Actual product renewals/invoices must confirm hosting SKU,
price/tax, term/renewal, cancellation deadline and mailbox/DNS bundle dependencies
before claiming savings. Never cancel the domain, DNS zone or email.

Draft for later owner-approved contact, not sent: “Please confirm the recurring
price and renewal date of web hosting for wadatrip.com and whether ending only
that hosting retains domain registration, ns13/ns14 DNS and buzondecorreo
mailboxes/MX/SPF/DKIM/DMARC unchanged. Do not process cancellation or migration.”
After confirmation/approval, cancel only independent unused hosting renewal.
Avoided annual cost equals the confirmed renewal invoice; monthly equivalent is
annual/12. If mail or DNS depends on the bundle, no safe cancellation or quantified
saving is established. No service, subscription or plan has been cancelled here.
Do not downsize Render during acceptance; propose it later using memory/CPU and
headroom evidence. Preserve DB/recovery. Invoices/usage can exceed compute prices.

## Historical preparation report (superseded where stated above)

## Scope and provenance

Base source: 4e2b2625971b3d126f9a2a1371ff6d7edab6521b, retaining the previously published operator inbox, traveler sessions and checkout recovery. Security overlays are copied byte-for-byte from deployed backend c3031e9ca83cd1393cf43d6c9f9b3b95872daf8a except the explicit changes in the manifest. The candidate registers the authenticated leads controller without registering Community. The final source and all modifications are SHA-256 verified against the immutable base.

Community application handlers/UI, new discovery UI, mobile and new AI functionality are excluded. Existing inactive legacy agent/itinerary files inherited from the base are not promoted or enabled. Existing financial recovery/webhooks remain intact; new bookings, including free bookings and capacity holds, are rejected in preparation-only mode.

The Community schema and its immutable migration are retained ONLY to preserve the already applied database history. Removing those migrations or tables would break lineage and risk data loss. No Community runtime entry or link is introduced. Device uploads are closed in code; historical clients/cloud Storage permissions need separate verification.

## Current production observations (read only, 29 October)

Render service wadatrip: c3031e9 is live, auto-deploy off, maintenance off; NODE_VERSION=24.22.1. This is later evidence than the older preparation reports. Payment credential is Test; PAYMENTS_LIVE_ENABLED=false and PAYMENTS_ACCEPT_NEW=false. Preparation-only=true, empty member/publication lists; document uploads, leads, lead search, Community, WadaAgent proxy, leads proxy and Provider Hub routing are false. Both internal/rate-limit secrets are present and at least 32 characters; their values were not printed.

PostgreSQL read-only history confirms 29 finished migration records, including operator inbox, Community and auth rate limits. There is no pending candidate migration for this database. Compare all checksums again immediately before an approved release. The two historical CRLF/LF differences require the existing documented original-byte evidence; do not change SQL, stored checksums or run migrate resolve to conceal them.

## Required environment (explicit; do not print secrets)

NODE_VERSION=24.22.1; OPERATOR_BETA_PREPARATION_ONLY=true; OPERATOR_BETA_MAX_OPERATORS=5; OPERATOR_BETA_USER_IDS empty initially; OPERATOR_BETA_PUBLICATION_USER_IDS empty; PAYMENTS_LIVE_ENABLED=false; PAYMENTS_ACCEPT_NEW=false. ENABLE_OPERATOR_DOCUMENT_UPLOADS, ENABLE_OPERATOR_LEADS, ENABLE_OPERATOR_LEAD_SEARCH, ENABLE_OPERATOR_LEADS_PROXY, ENABLE_WADAGENT_PROXY, ENABLE_COMMUNITY and FF_PROVIDER_HUB must all equal false. AUTH_RATE_LIMIT_SECRET and INTERNAL_SERVICE_TOKEN must be independent stable random secrets of at least 32 characters. Preserve JWT/Firebase/email/processor configuration and existing financial recovery services.

Vercel Production: VITE_API_BASE_URL=https://wadatrip.onrender.com, VITE_WADAAGENT_ENABLED=false, VITE_ADMIN_DEV_BYPASS=false. Retain www.wadatrip.com and wadatrip.com. Custom API-domain work is independent and requires no change for this beta. A build made with synthetic local variables is never a deployable web artifact.

## Local acceptance

Run immutable dependency installation with installation scripts disabled in a build copy; source must contain no dotenv, generated output, credentials, dumps or node_modules. Generate/validate Prisma with a synthetic explicit datasource and no root dotenv. Build Common, DB, Gateway and Provider Hub, plus the authenticated leads service for compile compatibility. Verify the source manifest before and after validation.

Security checks cover session changes/logout, unsafe returns, persisted OTP concurrency across two connections, MFA/admin boundaries, leads/internal guards, pre-Multer upload denial, default-empty/revoked allowlists, draft-only publication and availability ownership, preparation-only booking/payment denial, inbox ownership, price/capacity, financial lifecycle and existing recovery. PostgreSQL uses fresh synthetic local databases only. Chrome UI uses intercepted loopback APIs. No test should call a live processor/email or provision an operator account in production.

## Approval and deployment checklist

1. Owner reviews exact source manifest, changes and test report. Obtain explicit approval for commit/tag/push and cloud release; none is implied by local preparation. Identify the current backend and public frontend IDs again. Vercel read currently needs a valid session; do not refresh or publish automatically.
2. Record code/config versions, masked feature state, migration checksums and an encrypted configuration recovery plan without revealing credentials. Keep allowlists empty, new bookings/payments closed and auto-deploy off. Avoid generic maintenance mode that would block financial webhooks or recovery.
3. Take a fresh authorized PostgreSQL custom-format snapshot via verified TLS, with a read-only connection and bounded timeouts. Encrypt immediately with OS protection, private ACLs and checksum; keep it outside Git and deployment. Restore to an isolated local PostgreSQL instance; verify table fingerprints, migration records and successful restore. Do not count yesterday's backup as a fresh backup for a future cutover.
4. Compare migrations with production before any DDL. Expected pending=0 for the observed database. If different, stop and rehearse the exact additive delta on the authorized restored copy. A separate explicit approval is required for production migration. Never migrate automatically in build, predeploy or startup, and never run migrate dev/reset/db push/resolve in production.
5. Publish coordinated backend libraries/handlers from reviewed source with no independent old Provider Hub writer active. Readiness/health alone does not prove Node runtime: inspect startup runtime/version and effective configuration. Run preflight on the actual runtime, preserving webhooks and financial recovery.
6. Prepare and inspect Vercel production-target candidate without public-domain promotion, using approved real public variables. Verify no secrets or synthetic data/config is packaged. Owner approval precedes promotion. Preserve existing traveler/account/checkout/inbox routes and both public domains.
7. Conduct real-session acceptance using owner-controlled accounts: anonymous protected routes 401, wrong owner denied, administrator requires bound MFA, verified uninvited operator denied, enrolled operator can save/edit own draft and availability, publish/edit-public denied, revocation denies next mutation, other operator cannot read/edit private data, booking/checkout creation denied before holds/processor I/O. Do not issue fake JWTs or collect real identity documents. Existing booking reads/cancellations/recovery must continue.
8. Verify effective cloud-upload closure for old web/mobile clients. Assign a support owner, consent terms and manual business-review process; review the first genuine account before separately approving allowlist enrollment. Max five initially; no public publication permission or promise of Live payout.

## Smoke tests

GET /health=200; public catalog=200 with allowlisted fields; GET /bookings and /providers/me anonymously=401; unsigned POST /webhooks/stripe=401. Authorized-origin OPTIONS allows https://www.wadatrip.com; an unapproved origin receives no allow-origin header. All application Community routes remain unavailable. Use synthetic local actor tests for positive/negative booking, MFA, draft and upload behavior; live authenticated acceptance requires the owner's normal sessions and an explicit scope.

No smoke test creates charges, uploads documents, invokes acquisition or sends invitations. OTP abuse/load tests are local only; any real email acceptance is a separate approved send to an owner-controlled address.

## Rollback

Prefer backend c3031e9 and the exact pre-promotion Vercel deployment as the recovery targets because they already contain security gates. Keep admission/publication empty, preparation-only=true and new payments closed. Reverting application code never drops additive tables, review receipts or migration records. A database restore over newer activity requires a separate incident decision, recovery-point assessment and explicit approval; it is not normal application rollback. Old c30b2df lacks newer beta protections and is not a safe open-beta rollback.

## Remaining gates

Local validation does not verify production MFA, old Firebase Storage access, email delivery, real operator identity or commercial eligibility. JWT remains in localStorage and is exposed to a successful same-origin XSS; reviewed URL/session fixes do not add HttpOnly cookies or server revocation. OTP peer limits use the verified socket peer and can share a proxy bucket; test runtime behavior before admission without trusting arbitrary forwarding headers. Existing legacy financial exceptions remain outside this release and block Live money. This candidate neither approves the Peru payout corridor nor enables settlement or real payments. Geography is not an enrollment restriction; destination, legal identity, payee eligibility and display preferences remain distinct.
