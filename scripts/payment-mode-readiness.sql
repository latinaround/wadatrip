-- Read-only, counts only. Requires the payment-mode migration to be installed.
-- Does not classify historical data or authorize Live.
\set ON_ERROR_STOP on
\set VERBOSITY terse
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';
SELECT 'payment_mode_unknown' AS finding, count(*) AS count FROM "PaymentRecord" WHERE processor_mode IS NULL
UNION ALL SELECT 'unknown_mode_pending_or_external', count(*) FROM "PaymentRecord"
  WHERE processor_mode IS NULL AND (flow IS NOT NULL OR stripe_payment_intent_id IS NOT NULL
    OR stripe_checkout_session_id IS NOT NULL OR lower(btrim(status)) IN ('pending','processing','unpaid'))
UNION ALL SELECT 'unknown_mode_unfinished_refund', count(*) FROM "PaymentRecord"
  WHERE processor_mode IS NULL AND (resolution='refund_required' OR refund_status IN ('requested','processing','pending'))
UNION ALL SELECT 'booking_external_reference_without_known_mode', count(*) FROM bookings b
  LEFT JOIN "PaymentRecord" p ON p.booking_id=b.id WHERE p.processor_mode IS NULL
  AND (b.payment_intent_id IS NOT NULL OR b.checkout_session_id IS NOT NULL)
UNION ALL SELECT 'booking_paid_without_known_mode', count(*) FROM bookings b
  LEFT JOIN "PaymentRecord" p ON p.booking_id=b.id WHERE p.processor_mode IS NULL
  AND lower(btrim(b.payment_status)) IN ('paid','succeeded') AND (b.amount_cents IS NULL OR b.amount_cents<>0)
UNION ALL SELECT 'payment_records_test', count(*) FROM "PaymentRecord" WHERE processor_mode='test'
UNION ALL SELECT 'payment_records_live', count(*) FROM "PaymentRecord" WHERE processor_mode='live'
UNION ALL SELECT 'event_mode_unknown_unprocessed', count(*) FROM "PaymentEvent" WHERE processor_mode IS NULL AND processed_at IS NULL
UNION ALL SELECT 'provider_legacy_account_without_explicit_mode', count(*) FROM providers
  WHERE stripe_account_id IS NOT NULL AND stripe_test_account_id IS NULL AND stripe_live_account_id IS NULL
UNION ALL SELECT 'provider_live_account_present', count(*) FROM providers WHERE stripe_live_account_id IS NOT NULL
UNION ALL SELECT 'event_ledger_known_mode_conflict', count(*) FROM "PaymentEvent" e
  JOIN "PaymentRecord" p ON p.id=e.payment_record_id
  WHERE e.processor_mode IS NOT NULL AND p.processor_mode IS NOT NULL AND e.processor_mode<>p.processor_mode
UNION ALL SELECT 'payment_mode_constraints_missing_or_unvalidated', count(*) FROM (VALUES
  ('payment_processor_mode_valid'), ('payment_event_processor_mode_valid'), ('provider_mode_account_ids_valid')
) required(name) WHERE NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.connamespace=current_schema()::regnamespace
  AND c.conname=required.name AND c.convalidated)
ORDER BY finding;
COMMIT;
