-- Read-only. Run with psql -X -v ON_ERROR_STOP=1 -f scripts/payment-preflight.sql
-- Supply connection through an explicitly authorized PG service/environment.
-- Does not load repository .env files. Output contains counts only, never row data.
\set ON_ERROR_STOP on
\set VERBOSITY terse
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';
WITH refs AS (
  SELECT 'intent' kind, stripe_payment_intent_id ref, booking_id FROM "PaymentRecord"
  UNION ALL SELECT 'intent', payment_intent_id, id FROM bookings
  UNION ALL SELECT 'session', stripe_checkout_session_id, booking_id FROM "PaymentRecord"
  UNION ALL SELECT 'session', checkout_session_id, id FROM bookings
), duplicate_days AS (
  SELECT listing_id, date::date FROM listing_availability GROUP BY listing_id, date::date HAVING count(*) > 1
), occupied AS (
  SELECT listing_id, date::date day, sum(num_people::bigint) used
  FROM bookings WHERE status NOT IN ('cancelled', 'rejected') GROUP BY listing_id, date::date
)
SELECT 'external_reference_multiple_bookings' AS inconsistency, count(*) AS count
FROM (SELECT kind, ref FROM refs WHERE ref IS NOT NULL GROUP BY kind, ref HAVING count(DISTINCT booking_id) > 1) d
UNION ALL SELECT 'external_reference_empty', count(*) FROM refs WHERE ref IS NOT NULL AND btrim(ref) = ''
UNION ALL SELECT 'availability_duplicate_days', count(*) FROM duplicate_days
UNION ALL SELECT 'payment_without_booking', count(*) FROM "PaymentRecord" p LEFT JOIN bookings b ON b.id = p.booking_id WHERE b.id IS NULL
UNION ALL SELECT 'booking_paid_without_ledger', count(*) FROM bookings b LEFT JOIN "PaymentRecord" p ON p.booking_id = b.id
  WHERE p.id IS NULL AND lower(btrim(b.payment_status)) IN ('paid', 'succeeded') AND (b.amount_cents IS NULL OR b.amount_cents <> 0)
UNION ALL SELECT 'booking_expected_amount_unknown', count(*) FROM bookings WHERE amount_cents IS NULL
UNION ALL SELECT 'payment_expected_amount_unknown', count(*) FROM "PaymentRecord" WHERE amount_gross_cents IS NULL
UNION ALL SELECT 'payment_expected_amount_invalid', count(*) FROM "PaymentRecord" WHERE amount_gross_cents < 0 OR lower(currency) <> 'usd' OR currency IS NULL
UNION ALL SELECT 'payment_legacy_paid', count(*) FROM "PaymentRecord" WHERE lower(btrim(status)) = 'paid'
UNION ALL SELECT 'payment_succeeded', count(*) FROM "PaymentRecord" WHERE lower(btrim(status)) = 'succeeded'
UNION ALL SELECT 'payment_failed_needs_terminal_verification', count(*) FROM "PaymentRecord" WHERE lower(btrim(status)) = 'failed'
UNION ALL SELECT 'payment_refunded', count(*) FROM "PaymentRecord" WHERE lower(btrim(status)) = 'refunded'
UNION ALL SELECT 'payment_unknown_status', count(*) FROM "PaymentRecord" WHERE lower(btrim(status)) NOT IN ('pending', 'paid', 'succeeded', 'failed', 'refunded', 'unpaid', 'processing')
UNION ALL SELECT 'event_unprocessed', count(*) FROM "PaymentEvent" WHERE processed_at IS NULL
UNION ALL SELECT 'participants_invalid', count(*) FROM bookings WHERE num_people < 1
UNION ALL SELECT 'availability_capacity_invalid', count(*) FROM listing_availability WHERE spots_total < 0 OR spots_available < 0 OR spots_available > spots_total
UNION ALL SELECT 'occupancy_above_capacity', count(*) FROM occupied o JOIN listing_availability a ON a.listing_id = o.listing_id AND a.date::date = o.day WHERE o.used > a.spots_total
UNION ALL SELECT 'occupied_day_without_availability', count(*) FROM occupied o WHERE NOT EXISTS (SELECT 1 FROM listing_availability a WHERE a.listing_id = o.listing_id AND a.date::date = o.day)
UNION ALL SELECT 'booking_ledger_reference_mismatch', count(*) FROM bookings b JOIN "PaymentRecord" p ON p.booking_id = b.id
  WHERE (b.payment_intent_id IS NOT NULL AND p.stripe_payment_intent_id IS NOT NULL AND b.payment_intent_id <> p.stripe_payment_intent_id)
     OR (b.checkout_session_id IS NOT NULL AND p.stripe_checkout_session_id IS NOT NULL AND b.checkout_session_id <> p.stripe_checkout_session_id)
UNION ALL SELECT 'booking_ledger_money_state_contradiction', count(*) FROM bookings b JOIN "PaymentRecord" p ON p.booking_id = b.id
  WHERE (lower(btrim(b.payment_status)) IN ('paid', 'succeeded') AND lower(btrim(p.status)) IN ('pending', 'failed', 'unpaid', 'processing'))
     OR (lower(btrim(b.payment_status)) = 'refunded' AND lower(btrim(p.status)) <> 'refunded')
UNION ALL SELECT 'cancelled_with_unsettled_financial_reference', count(*) FROM bookings b LEFT JOIN "PaymentRecord" p ON p.booking_id = b.id
  WHERE b.status IN ('cancelled', 'rejected') AND (b.payment_intent_id IS NOT NULL OR b.checkout_session_id IS NOT NULL OR p.id IS NOT NULL)
    AND coalesce(lower(p.status), lower(b.payment_status), 'pending') NOT IN ('refunded')
ORDER BY inconsistency;
COMMIT;
