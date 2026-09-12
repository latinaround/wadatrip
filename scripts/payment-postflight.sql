-- Read-only post-migration validation. Counts only. Never auto-validates constraints.
\set ON_ERROR_STOP on
\set VERBOSITY terse
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';
WITH occupied AS (
  SELECT listing_id, date::date day, sum(num_people::bigint) used FROM bookings
  WHERE inventory_state = 'held' OR (inventory_state IS NULL AND status NOT IN ('cancelled', 'rejected'))
  GROUP BY listing_id, date::date
)
SELECT 'event_completion_state_mismatch' AS inconsistency, count(*) AS count FROM "PaymentEvent"
  WHERE (status = 'processed') <> (processed_at IS NOT NULL)
UNION ALL SELECT 'event_failed_or_unfinished', count(*) FROM "PaymentEvent" WHERE processed_at IS NULL
UNION ALL SELECT 'payment_needs_review', count(*) FROM "PaymentRecord" WHERE resolution IS NOT NULL
UNION ALL SELECT 'booking_legacy_inventory_unknown', count(*) FROM bookings WHERE inventory_state IS NULL
UNION ALL SELECT 'paid_confirmation_without_ledger', count(*) FROM bookings b LEFT JOIN "PaymentRecord" p ON p.booking_id = b.id
  WHERE b.status IN ('confirmed', 'completed') AND (b.amount_cents IS NULL OR b.amount_cents <> 0)
    AND (p.id IS NULL OR lower(btrim(p.status)) NOT IN ('paid', 'succeeded'))
UNION ALL SELECT 'confirmed_without_held_inventory', count(*) FROM bookings WHERE status IN ('confirmed', 'completed') AND inventory_state = 'released'
UNION ALL SELECT 'occupancy_above_capacity', count(*) FROM occupied o JOIN listing_availability a ON a.listing_id = o.listing_id AND a.date::date = o.day WHERE o.used > a.spots_total
UNION ALL SELECT 'capacity_cache_mismatch', count(*) FROM listing_availability a LEFT JOIN occupied o ON a.listing_id = o.listing_id AND a.date::date = o.day
  WHERE a.spots_available <> greatest(0, a.spots_total - coalesce(o.used, 0))
UNION ALL SELECT 'unvalidated_core_constraints', count(*) FROM pg_constraint
  WHERE connamespace = current_schema()::regnamespace AND NOT convalidated
    AND conrelid IN ('bookings'::regclass, 'listing_availability'::regclass, '"PaymentRecord"'::regclass, '"PaymentEvent"'::regclass)
UNION ALL SELECT 'required_constraints_missing', count(*) FROM (VALUES
  ('PaymentRecord_booking_id_fkey'), ('booking_inventory_valid'), ('booking_participants_positive'),
  ('availability_capacity_valid'), ('booking_external_ids_nonempty'), ('payment_external_ids_nonempty'),
  ('managed_payment_valid'), ('payment_event_state_valid'), ('payment_flow_valid'), ('payment_resolution_valid')
) required(name) WHERE NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.connamespace = current_schema()::regnamespace AND c.conname = required.name)
UNION ALL SELECT 'required_indexes_missing', count(*) FROM (VALUES
  ('idx_bookings_listing_date'), ('listing_availability_listing_day_key'),
  ('PaymentRecord_stripe_payment_intent_id_key'), ('PaymentRecord_stripe_checkout_session_id_key'),
  ('bookings_payment_intent_id_key'), ('bookings_checkout_session_id_key'),
  ('PaymentEvent_booking_id_created_at_idx'), ('PaymentEvent_status_last_attempt_at_idx')
) required(name) WHERE NOT EXISTS (SELECT 1 FROM pg_indexes i WHERE i.schemaname = current_schema() AND i.indexname = required.name)
ORDER BY inconsistency;
COMMIT;
