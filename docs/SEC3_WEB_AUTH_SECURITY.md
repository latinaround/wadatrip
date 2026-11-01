# SEC-3 secure browser authentication

Local candidate only; combined SEC-1/2/3 release requires production authorization.

## Transport and authority

Native retains Bearer credentials in SecureStore and the PostgreSQL session guard.
Web uses opaque 256-bit credentials in generation-specific __Host- cookies: Secure,
HttpOnly, SameSite=Lax, Path=/, no Domain. No primary token in JSON, URLs, browser
storage or Authorization. A separate HttpOnly flow cookie grants no business access.
PostgreSQL validates ownership, status, hash, generation, account epoch and expiry.
No signature-only fallback. DB errors close access. MFA binds to session/generation/epoch.

Browser memory holds CSRF proof and a non-secret session reference. Exact Origin,
HTTPS API Host, credentialed CORS and X-Wadatrip-Web are required. State changes
validate session-bound CSRF, including login, logout and MFA. WebSockets use the
same registry and CSRF; native no-Origin sockets retain their existing contract.
Internal delegation forwards a validated credential only, not the browser Cookie header.

Generation-specific cookie names prevent late Set-Cookie responses overwriting a
later credential. PostgreSQL tombstones/generations prevent restoring revoked rows.
The client serializes transitions with Web Locks, guards responses and body reads,
and retains an exact logout retry context. Failed revocation blocks new sign-in.
Canonical /auth/me validation precedes identity publication; failed validation
retires the just-issued context. Storage notifications contain random revisions only.
Focus restores check the registry; bfcache/account changes invalidate cached identity.

## Browser policy

The shared request helper uses credentials:include, no-store, redirect:error,
bounded timeouts and exact API origin. Reject caller-provided Authorization.
Scripts are self-only, without unsafe-inline or unsafe-eval. Inline styles remain
allowed for current React/Radix styling. Frames/objects/base injection are restricted;
private API responses use no-store. Fonts use system fallbacks; the old Google CSS
import was removed because it contradicted self-only CSP. Do not add third-party
scripts or broaden CSP without review. Unused legacy admin helpers are not imported
by the active app; native JWT code and memory-only MFA proofs are intentional.

## Configuration and rollout

Approved production architecture: https://www.wadatrip.com ->
https://api.wadatrip.com -> existing Render backend. Host-only cookies belong only
to api. No onrender third-party-cookie fallback and no wildcard preview origins.
Set AUTH_WEB_ORIGIN, AUTH_PUBLIC_API_ORIGIN and independent AUTH_CSRF_SECRET;
Vercel VITE_API_BASE_URL must match api. Preserve OTP/rate-limit/internal/JWT/MFA
secrets and existing closed beta/payment/upload flags. Session policy remains
8h absolute/30min idle web and up to 7 days native, bounded by existing server settings.

SEC-3 adds no migration. Preserve the full 30-file history, including SEC-2
20261030000000_auth_sessions. Check production migration state before any separately
approved cutover; do not migrate during build. Old web credentials require sign-in again.

Review task-area manifest.json, exact-files.txt, acceptance.json, REPORT.md and
ROLLOUT-ROLLBACK.md. Deploy SEC-1/2/3 together only after external DNS/TLS/proxy,
owner MFA and approved real-email acceptance. Both allowlists and new money stay closed.
Rollback floor retains registry/CSRF/cookies/revocation. Keep tombstones, monotonic
epochs/generations/cutoffs. Never restore a pre-revocation DB as ordinary rollback
or return to the historical signature-only backend. Test restored backups in isolation;
disaster recovery must invalidate sessions before reopening access.

## Verification boundaries

Six React suites retain their original business, ownership, race and payment assertions
with a shared synthetic session API. Separate HTTPS tests use real Nest controllers,
PostgreSQL 17 and all migrations. Chrome/Edge exercise actual cookies and the compiled
React application under CSP. Full React journey covers OTP login, profile, draft create/
edit, availability, account switching, logout, rejected cookie reuse, admin MFA/isolation,
and blocked publication/reservations/checkout. No production credentials or services.

Financial regressions use a local processor simulator, not a Stripe Sandbox transaction.
Native compatibility is automated module/SecureStore testing; physical Android/iOS,
Safari/Firefox and real IdP sessions require separate acceptance. Linux clean builds
use Prisma no-engine type generation; database runtime integration is on Windows.

## Final CORS and trusted-peer release follow-up

Gateway responseSecurity rejects every explicitly untrusted browser Origin with a
controlled, private no-store 403 before CORS, parsers, controllers or proxies run.
Malformed/null origins do not become native requests. The exact configured www origin
keeps credentialed CSRF/MFA preflights; originless native requests retain registered
Bearer authorization. Invalid browser policy returns a controlled 503, without echoing
the supplied origin or credentials. CORS remains a transport control, not authorization.

OTP quotas derive from the real socket address, never an untrusted req.ip fallback.
Render forwarding is opt-in, requires Render runtime identity and a valid private or
loopback socket, and selects from the configured right-counted suffix. Every address
in that suffix must parse as an IP. Caller prefixes, Forwarded, CF-Connecting-IP and
X-Real-IP do not select a bucket. IPv6 case/compression and IPv4-mapped spellings are
canonicalized; existing canonical IPv4 quota keys remain unchanged. Unsupported zone
identifiers and malformed chains fail closed. This adds no dependency or migration.

Focused real HTTP regressions live in scripts/sec3-cors-proxy.test.cjs. PostgreSQL
rate-limit tests cover independent pools, concurrent spoofed prefixes, independent real
clients, canonical address quotas and rejection before transaction side effects.
The HTTPS session suite checks CORS denial before creating users, sessions or buckets.

Two-hop onrender ingress has historical production probe evidence. That is not proof
for the new api.wadatrip.com ingress. Diagnostics are disabled in current production;
locally simulated chains and health-only responses cannot establish its effective
quota peer. Retain that as a release gate until bounded, owner-authorized production
observability confirms baseline/prefix invariance and the correct client position.
Do not enable diagnostics or change trusted hop depth without approval. Keep both
allowlists, publication and new payments closed during the acceptance window.
