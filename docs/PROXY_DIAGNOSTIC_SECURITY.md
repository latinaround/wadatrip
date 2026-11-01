# Integrated SEC-1/2/3 private proxy acceptance

Local preparation only. No production operation is authorized by this document.
Parent sealed candidate: `logs/sec123-final-20261030`, manifest SHA256
`56e4b4afa0029e59db1c3597680e7accf1806a3d5c4a36592d618a56d4af7799`.
Do not deploy the separate legacy diagnostic patch.

## Evidence and design

Render documents X-Forwarded-For and request logs/request IDs, but these do not prove
the value selected by our application, the custom-ingress trusted suffix or resistance
to supplied prefixes. No raw customer logs were collected or paid logging enabled.
The previous onrender-only result remains historical. References:
https://render.com/articles/how-render-handles-ddos-attacks,
https://render.com/docs/logging, https://api-docs.render.com/reference/list-logs.

The diagnostic adds no route. GET `/health` contains NO diagnostic hook. All commands
use existing POST `/admin/mfa/verify`, with the explicit optional body:

```
{"proxy_diagnostic":{"action":"start"}}
{"proxy_diagnostic":{"action":"sample","client":"a","label":"baseline"}}
{"proxy_diagnostic":{"action":"read"}}
{"proxy_diagnostic":{"action":"stop"}}
```

Labels: baseline, prefix-a, prefix-b. Clients: a, b. No other options are accepted.
Every command, including read/sample, requires the configured administrator's active
PostgreSQL web session, host-only Secure/HttpOnly/SameSite=Lax cookies, trusted HTTPS
origin/host, JSON, `X-Wadatrip-Web: 1`, session-version-bound CSRF, and current
`X-Admin-Proof`. Proof and window ownership bind to session ID, generation and user
epoch. Native Bearer and internal delegation cannot use this diagnostic. Their normal
registered session contracts remain unchanged. Normal MFA `{code}` remains unchanged.

The existing 10-minute absolute authorization limit, 5-minute maximum capture window,
six exact sample slots, automatic expiry timers and monotonic/wall clock checks remain.
One start per process; stopping cannot renew it. No raw IPs, credentials, cookies, OTPs,
proofs or persistent pseudonyms are logged/returned/persisted. Per-window random-key
HMACs stay in memory and are zeroed/cleared on stop/expiry. Output contains only counts,
depths and equality/pass/fail booleans, with no-store. Delayed authorized requests cannot
restore stopped state. Unexpected adapter errors become generic 503 responses.
JS garbage collection/OS crash dumps are outside a guaranteed secure-erasure claim.

## Minimal production sequence — separate approval required

1. Reconfirm exact Render/Vercel deployments, one backend process/instance, healthy
   custom domain/TLS, manual deploy controls and no request-header/body logging. Keep
   preparation-only=true, both operator allowlists empty, payments/new bookings off.
   Review this derivative's manifest and fresh recovery readiness. No legacy diagnostic
   deployment, DNS change, new route, permanent diagnostic secret or schema change.
2. Approve the coordinated commit/push, maintenance, fresh encrypted backup plus isolated
   restore, `20261030000000_auth_sessions`, security secrets/config and paired backend /
   frontend releases. Never expose mixed signature-only and registry backends. Configure
   API origin `https://api.wadatrip.com`, web origin `https://www.wadatrip.com`; frontend
   Production API must use the former. Preserve the 29 historical migrations/Community.
3. Promote the complete reviewed SEC candidate with diagnostics=false. Verify all
   instances enforce the registry before controlled owner access. Existing users must
   authenticate again. Owner confirms the sole test email address and performs real
   email/login/MFA privately; do not collect credentials in chat, files or console logs.
4. Approve a bounded window on that same reviewed build: set diagnostics=true, set
   `AUTH_PROXY_DIAGNOSTICS_ADMIN_ID` to the approved existing owner ID, and set
   `AUTH_PROXY_DIAGNOSTICS_EXPIRES_AT` to a UTC ISO timestamp with milliseconds, at most
   10 minutes beyond expected process startup. Preserve trusted hops=2 and all auth,
   rate-limit and MFA secrets. Apply via Render **Save and deploy**, not Save only or
   Restart. Late/invalid startup fails closed; do not extend automatically. If a valid
   absolute window can safely be included in the coordinated code promotion itself,
   that can avoid this activation-only environment deployment; retain all acceptance
   gates and require separate approval for any retry.
5. Use an owner-controlled local headed browser harness on the exact www origin. It
   keeps primary credentials exclusively in HttpOnly cookies and MFA proof in transient
   memory. It obtains the existing authenticated context through POST
   `/auth/web/bootstrap` with `bootstrap_nonce: crypto.randomUUID()` and credentialed
   JSON/X-Wadatrip-Web. Reuse the returned session_version and csrf_token on every POST.
   Obtain MFA via the normal approved owner flow, retaining proof only in memory. Start
   the window through the command above. No primary credential extraction/export.
6. Use that SAME session/browser on two independent owner-controlled network egresses
   (for example approved Wi-Fi then owner hotspot), without logging out or switching
   account. Owner must confirm they are independent; a VPN exit unchanged is not enough.
   Take baseline/prefix-a/prefix-b samples for client a and then b within five minutes.
   For spoof samples the local Playwright network interceptor modifies ONLY outgoing
   sample POSTs to the exact API route: prefix-a supplies X-Forwarded-For 192.0.2.1;
   prefix-b supplies 192.0.2.2, 192.0.2.3; baseline supplies no XFF. Also provide conflicting
   synthetic Forwarded/X-Real-IP. Render must append its real chain; the application
   must never synthesize a chain from command body data. Use the tested interceptor
   pattern in `scripts/proxy-diagnostic.postgres.test.mjs`. Ordinary browser fetch cannot
   set these headers through current CORS: do not widen CORS or export cookies to curl
   to work around it. Do not send credentials to a third-party proxy or operator.
7. Read aggregate results through the same authenticated POST. Require captured=6,
   depths [2,3,4] for both clients, prefix_invariant=true for both,
   distinct_clients=true and assessment=pass. This proves observed selection/separation
   for these requests, not an immutable provider topology guarantee. Unexpected/missing
   results mean fail/incomplete; do not guess a new hop count, raise OTP quotas, use
   req.ip/leftmost XFF, or weaken guards. Re-enter maintenance if peer trust is uncertain.
8. Stop and verify read/sample rejection; remove temporary ID/expiry and set flag=false.
   Apply disabled values to the existing reviewed build with **Save and deploy**. Verify
   applied configuration/deployment plus health, owner auth/MFA and disabled controls.
   Expiry already shuts access even if the flag remains true; that does not replace
   dashboard cleanup. Delete local transient proof/context/results and close the
   harness. Retain only anonymous aggregate pass/fail and deployment/time references.
9. Finish coordinated owner acceptance (draft/profile/availability, isolation, logout /
   revoked reuse, HTTP/socket, negative publication/new booking/payment tests). No
   invitations or external accounts until the founder separately approves the operator.

Render semantics checked 2026-10-31: Save only does not change the running process;
Save and deploy reuses the build with new env; Restart service reuses the current
deployment's user-defined variables. Env application replaces processes and may drain
connections/reset volatile samples. Require a stable single instance before starting;
rolling old/new processes cannot share a diagnostic window. References:
https://render.com/docs/configure-environment-variables, https://render.com/docs/deploys.

## Recovery floor

On privacy, auth, origin, session, MFA, selector or business-gate failure: stop/disable
diagnostics, restore reviewed maintenance, and recover only to a tested SEC-2-or-later
backend or the deny-all emergency backend. Never restore the legacy production backend
or old JWT frontend. Keep auth_sessions, revocation tombstones, generations, epochs and
all business/payment history; no reverse migration or key rollback. Diagnostic cleanup
does not need schema changes. The sealed parent SEC candidate still contains its old
unsafe logger, so it is only a fallback with diagnostics=false and no temporary ID/expiry.
Prefer this reviewed integrated source floor. No live rollback deployment IDs exist yet.

The instrumentation is optional if Render can provide equivalent private, authoritative
selector/chain evidence for both controlled real clients; that has not been established.
Local simulated edges and provider docs alone never grant production acceptance.
