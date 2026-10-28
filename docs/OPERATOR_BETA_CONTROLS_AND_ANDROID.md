# Operator Beta controls and Android validation

Local implementation: 2026-10-26. No deployment, production migration, Stripe operation, invitation, commit or push. Existing work is preserved.

## Beta boundary

The minimum beta uses a reviewed backend allowlist of canonical account IDs, not a reusable access code or a client-selected role. The default list is empty. Default cohort maximum is five; explicit configuration can raise it up to 25. This is an operational safety cap, not a measured capacity claim.

`OPERATOR_BETA_USER_IDS` grants preparation access after server authentication, active-account and verified-email checks. `OPERATOR_BETA_PUBLICATION_USER_IDS` is a separate subset; leave it empty for the preparation beta. Administrative overrides require the existing session-bound MFA proof. Removing an ID blocks subsequent workspace mutations on an updated instance; configuration must be applied consistently to every instance.

Both Gateway and Provider Hub enforce draft creation, status changes and availability/workspace access. An enrolled pending provider can prepare a draft without becoming approved. Editing an already-public listing requires publication permission. Revocation does not remove access to existing traveler bookings, cancellation, financial settlement or historical provider reads. A read no longer claims an unowned legacy provider unless the verified account is enrolled. No historical ownership or booking is rewritten by this implementation.

Real payments now additionally require `OPERATOR_BETA_PREPARATION_ONLY=false` **explicitly**, as well as all existing Live gates. The default is preparation only. Existing webhooks, refunds and reconciliation are not disabled by this new-payment gate. Invitation, provider approval, public publication and authorization for real money remain separate decisions.

The operator web workspace shows server-derived beta access and explains preparation versus publication and money. Accounts without publication approval see “Save draft tour”; direct API publication attempts still fail. The access response has `Cache-Control: no-store`.

Device image uploads are closed in the web adapter and removed from its Firebase SDK path; the operator file controls are disabled. Existing covers and reviewed photo URLs remain usable. Identity-document ingestion remains closed before Multer. **This does not change or certify the deployed Firebase Storage rules, invalidate old bundles or revoke existing download URLs.** Before external beta, verify/close cloud writes through the authorized Firebase project, or prove that the old write path is inaccessible. Never collect IDs, bank details or customer documents through an unverified upload path.

No invitation-token database or new marketplace schema was needed. A manual, capped allowlist is sufficient for the first controlled cohort; add a durable invitation lifecycle only when operational need justifies it.

## Configuration and operational acceptance

Apply only after a reviewed release and explicit deployment approval:

- `OPERATOR_BETA_USER_IDS`: at most five reviewed existing account IDs initially. No raw emails, wildcard or client-supplied IDs.
- `OPERATOR_BETA_PUBLICATION_USER_IDS`: empty for preparation beta.
- `OPERATOR_BETA_PREPARATION_ONLY=true`, `PAYMENTS_LIVE_ENABLED=false`.
- `ENABLE_OPERATOR_DOCUMENT_UPLOADS`, `ENABLE_OPERATOR_LEADS`, `ENABLE_OPERATOR_LEAD_SEARCH`: closed. Lead acquisition has its own approval boundary.
- Stable, high-entropy `AUTH_RATE_LIMIT_SECRET` and `INTERNAL_SERVICE_TOKEN`, each at least 32 characters; never paste values into chat or logs.
- Run `node scripts/operator-beta-preflight.cjs` in the intended runtime. It reads environment only, prints counts/error categories and fails closed. It does not inspect a DB, apply migrations, fetch credentials or send invitations.

The new allowlist requires no migration. The preceding security block **does** require `20261026000000_auth_request_limits` before the new login-code handler. In disposable PostgreSQL this turn, the predecessor chain was applied first, a synthetic existing user was inserted, preflight reported zero table/zero migration record/zero unfinished migrations, the additive migration applied, and the original row remained identical. Postflight reported four constraints, two indexes, zero invalid rows and zero unfinished migrations. Migration command duration was approximately 1.2 seconds. This was synthetic data, **not a current production-copy rehearsal**. The first disposable attempt stopped before provisioning because PostgreSQL had not finished starting; the harness now checks readiness. Original container state is restored after each attempt.

Do not deploy this dirty checkout wholesale. Integrate the explicit file scope with the earlier security block onto the correct release. Coordinate common, Gateway and Hub versions: old services can bypass new beta gates. Pause new operator mutations during the cutover; preserve webhook/recovery processing. Keep the existing schema table on application rollback; returning to old code also removes these security controls.

Before inviting the first five operators: authorized snapshot/copy rehearsal where required, verified login and MFA in the deployed runtime, documented peer/proxy quota behavior, coordinated release, verified cloud-upload closure, named support owner, beta terms/consent and a manual identity/business review checklist. Verification by email establishes email control, not a professional license or legal identity. Country/residence/business/service/payout eligibility must be reviewed separately; no Peru-only rule was added to shared access control.

## Android changes and evidence

`App.js` now respects the explicit agent flag and does not mount the experimental agent while signed out. The app configuration defaults it off. A stable top-level provider component prevents remounting the navigation tree whenever the parent app state changes. Development navigator debug messages were removed; LogBox/error reporting was not suppressed.

The native development run exposed `ConcurrentModificationException` in Expo 51.0.39's `ReactNativeHostWrapperBase`: its reflection cache used unsynchronized AndroidX `ArrayMap`. A pinned two-line patch uses `ConcurrentHashMap`. The JVM stress reproduction uses the installed AndroidX implementation and the same cache-miss get/put pattern: 139 errors before, zero after across 1,200 rounds with 12 concurrent callers. This tests the cache pattern, not an entire Android activity. The reproducible check and patch live in the mobile repository; dependency versions and lockfile remain unchanged.

The debug APK compiled offline and installed both on the existing emulator and a fresh, disposable API 36 emulator. The final Android Hermes export and TypeScript no-emit check passed with an explicit synthetic localhost backend and no private dotenv. These artifacts are test evidence and must not be published with their synthetic configuration.

The original emulator also encountered an Android accessibility-service/IPC stall affecting application focus and Chrome. An ANR is retained as a failed observation; it is not counted as a successful native smoke test. Its data was not wiped. Native UI acceptance was recorded separately from build/export and synthetic contract tests on a fresh disposable emulator. iOS and store release signing are outside this block.

Evidence: ignored `logs/beta-android-20261026/`. Final native acceptance and exact counts are recorded in the completion section below after testing finishes.

## Exact source scope

Platform:

1. `libs/common/src/security.ts`
2. `apps/gateway/src/controllers/providers.controller.ts`
3. `apps/gateway/src/services/payment-config.service.ts`
4. `services/provider-hub/src/controllers/listings.controller.ts`
5. `services/provider-hub/src/controllers/providers.controller.ts`
6. `apps/web/src/services/mediaUpload.js`
7. `apps/web/src/components/OperatorBetaNotice.jsx` (new)
8. `apps/web/src/pages/OperatorToursNew.jsx`
9. `scripts/operator-beta-access.test.cjs` (new)
10. `scripts/beta-media.test.cjs` (new)
11. `scripts/operator-beta-preflight.cjs` (new)
12. `scripts/operator-beta-preflight.test.cjs` (new)
13. `scripts/mobile-beta-runtime.test.cjs` (new)
14. `scripts/payment-launch-safety.test.cjs` (positive Live fixtures explicitly leave preparation-only mode; no real processor)
15. `docs/OPERATOR_BETA_CONTROLS_AND_ANDROID.md` (new)

Mobile (`C:/Projects/wadatrip-mobile`):

1. `App.js`
2. `app.config.ts`
3. `patches/expo+51.0.39.patch` (new)
4. `scripts/HostCacheRace.java` (new)
5. `scripts/mobile-host-cache.test.ps1` (new)
6. `src/screens/ToursScreen.js` (preserves country, currency and duration as the catalog object is passed to tour details; before the fix all three mapping checks failed)

Protected platform `package.json`, `.yarn/install-state.gz`, `apps/web/src/pages/Account.jsx` and mobile `.env`, `.env.development`, `package.json`, `package-lock.json` are not part of this block.

## Completion and validation

- Platform regression: **454 checks passed** across isolated Node processes, including security, payment lifecycle, inventory/capacity, pricing, traveler auth, admin/community and beta controls. The three final catalog-to-detail mapping assertions passed after each failed against the old mapper. Mobile auth/session, trip history, secure storage and booking-contract suites: **137 passed**. These are separate suites; Android UI acceptance is not counted as a unit test.
- Disposable PostgreSQL: **4/4 checks passed** for additive migration application, preserving a synthetic pre-existing user row, constraints/indexes and postflight state. This was an isolated local disposable database, not production or a current production copy.
- Android: native debug APK build and install passed; final Hermes Android export passed; mobile TypeScript no-emit passed. The disposable emulator restored the signed-in synthetic traveler session, opened Explore, showed the synthetic tour at USD 50 and 6h, showed country PE and the USD 50 detail, and opened the reservation form with a server-provided date and capacity. The test stopped before creating a booking or initiating checkout. No Stripe call or production business API call was made.
- The marketplace card now retains the API's duration, currency and country through navigation. USD display does not imply that non-USD checkout is enabled; the current payment pilot remains gated separately.
- `git diff --check` passed in both the platform and Android source repositories after the final changes. Protected package/config files retain their recorded hashes.

**Beta decision: not ready to invite external operators yet.** Local access/publication/money gates are implemented, but this dirty checkout is not a releasable unit. The prior security changes and this block must be reviewed and released together; the additive auth-rate-limit migration must be applied through the authorized migration process; production runtime configuration and proxy-level abuse controls must be verified; the old Firebase upload path/cloud rules must be confirmed closed; and operator identity/commercial review and beta consent/support procedures must be ready. Real-money bookings remain blocked pending Stripe's account-specific payout corridor decision, legal/compliance review, coordinated live configuration and a controlled end-to-end funds reconciliation. Android has no store build/sign-off, physical-device matrix or iOS validation in this work.

Evidence artifacts are local and ignored under `logs/beta-android-20261026/`; they are not release inputs. No files were staged or committed, no service was deployed, and no migration, invitation or real transaction was initiated.
