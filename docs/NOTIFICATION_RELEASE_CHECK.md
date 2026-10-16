# Booking email template release check

Scope: booking-email presentation only. No payment, inventory, schema, recipient
authorization, outbox-claim or financial-state changes.

The email worker re-renders pending messages from booking data. It does not store
the exact first-send payload. Therefore changing templates during an ambiguous retry
can change the request body under an existing idempotency key. Resend rejects that
combination with HTTP 409; changing the key to bypass it could duplicate an email.
See [Resend idempotency semantics](https://resend.com/changelog/idempotency-keys).
Keys are retained for 24 hours, not permanently. Do not describe email delivery as
an unlimited exactly-once guarantee. DB sent-state prevents normal repeated sends.

## Read-only preflight

Use `scripts/notification-release-preflight.sql` with a TLS, read-only connection.
It reports counts only. Never print credentials, recipients or message bodies.

- Active leases: wait for the existing send attempt to finish; do not reset claims.
- Attempted pending notifications: investigate with the old template and provider
  evidence. Do not reset attempts, change keys or blindly resend with new copy.
- Failed notifications: review separately; never automatically replay on deployment.
- Invalid statuses: stop and investigate.
- A clear snapshot is evidence at that moment, not a lock against new traffic.

## Controlled release

1. Record the exact running Render commit, source diff, current mode and command
   configuration. Confirm no migration or schema change is introduced by this patch.
2. Check outbox counts immediately before release. For an active marketplace, pause
   the notification worker using its existing flag and let in-flight sends finish
   before changing templates. Preserve webhooks, payment recovery and outbox rows.
3. Resolve any attempted pending messages using the original payload/provider
   evidence. Never delete history to obtain a clean preflight result.
4. Deploy the reviewed commit in the already-approved payment environment. Do not
   activate Live, change keys, run migrations or replay failed messages for this patch.
5. Verify health, deployed commit and unchanged payment configuration. Resume the
   existing worker only after attempted pending cases are resolved. Recheck counts.
6. A real test email requires a separately authorized synthetic booking or delivery;
   local tests inject a fake sender and never send mail. Existing customer traffic
   must be treated as real communication even when its payment was in Sandbox.

If a mixed-version send or ambiguous delivery is found, stop automated replay and
investigate. Rolling back code does not retract an email already delivered. Exact
payload persistence is a separate reliability improvement, not part of this patch.
