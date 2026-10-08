# Separating historical test accounts from administrative reporting

Decision, 2026-10-08: preserve all historical records. Exclude the explicitly reviewed test user IDs from the default `/admin/users` count and page. Do not interpret unknown accounts, roles, provider approval or booking counts as verified people or revenue.

## Classification source

`apps/gateway/src/services/admin-user-data.service.ts` maintains a bounded, reviewed registry of 19 technical user IDs: four historical Guide Smoke accounts; three Codex Traveler accounts; nine historical traveler/auth/card/LoginCheck/Verify/Kiara/Codex test accounts; two E2E accounts; one seeded Demo Traveler.

Evidence: the administrative records reviewed with the owner on 2026-10-08; the Guide Smoke generator in `scripts/smoke-guide.ts`; the Demo Traveler seed in `libs/db/prisma/seed.ts`; a read-only PostgreSQL check of the exact IDs and associations. The registry contains no emails, names, credentials or payment references. No future account is classified using a name, email suffix or client-supplied flag. Registry changes require explicit review of the technical ID and evidence, code review and release.

Operational owner accounts are not included. Konuralp, Guest User and Test Buyer remain unclassified and visible pending investigation. `unclassified` is deliberately not a claim that an account is a real customer or that legal identity has been verified.

## API and UI contract

- `/admin/users` defaults to `data_scope=non_test`.
- `data_scope=test` returns only the explicit registry; `all` preserves the full view.
- Role and search filters compose with the data scope before database count and pagination. The count, excluded count and page use a Repeatable Read transaction.
- `data_category` is an admin-only computed response field: `test` or `unclassified`. The server controls it; browser identity/profile payloads do not.
- `excluded_test_accounts` counts the known tests excluded by the current role/search query. It is not the count of all tests in the database.
- Existing primary JWT, current admin eligibility, session-bound MFA proof, no-store responses and audit logging still apply to every scope.

## History and money safety

Classification is a reporting annotation, not a financial state. No users, bookings, payments, providers, listings or inventory are updated, deleted or disabled. There is no migration or production data repair in this change. The existing financial issue view is not filtered, and test bookings still consume inventory according to their actual lifecycle.

One historical E2E account has a PaymentRecord; two Guide Smoke accounts own listings. Their obligations and payment mode must be investigated before cleanup. Test user classification never proves that a payment occurred in Stripe Test, that it can be ignored, or that an associated booking may be cancelled safely.

This release separates user-reporting counts only. There is no verified revenue dashboard here; future business aggregates must explicitly separate test data while retaining financial reconciliation visibility. Do not report booking-row counts as paid sales.

## Scope and future maintenance

This small historical registry avoids a production schema change and avoids guessing. It does not provide a general mutable tagging UI or catch new tests automatically. Future automated tests should run against disposable/local databases. If ongoing classification becomes operationally necessary, move the same explicit classification into a database contract with authenticated, audited changes; do not make caller-selectable names or addresses classification authority.
