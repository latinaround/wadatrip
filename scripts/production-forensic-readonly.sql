-- Forensic snapshot: technical identifiers, financial fields and presence flags only.
-- Explicit connection required. Never loads .env; never emits stored payloads or contact data.
-- Compatible with the historical schema before payment_lifecycle.
\set ON_ERROR_STOP on
\set VERBOSITY terse
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';
SET LOCAL TIME ZONE 'UTC';

SELECT jsonb_build_object('section', 'migration_history', 'rows', jsonb_agg(row_to_json(m) ORDER BY m.migration_name)) FROM (
  SELECT migration_name, started_at, finished_at, checksum, applied_steps_count,
    rolled_back_at, logs IS NOT NULL AS logs_present, length(logs) AS logs_length
  FROM _prisma_migrations
) m;

SELECT jsonb_build_object('section', 'schema_contract', 'columns', (
  SELECT jsonb_agg(jsonb_build_object('table', table_name, 'column', column_name,
    'type', data_type, 'nullable', is_nullable, 'default', column_default) ORDER BY table_name, ordinal_position)
  FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN
    ('users', 'providers', 'listings', 'bookings', 'PaymentRecord', 'PaymentEvent', 'OperatorWallet', 'listing_availability')
), 'indexes', (SELECT jsonb_agg(jsonb_build_object('name', indexname, 'definition', indexdef) ORDER BY indexname)
  FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('listings', 'PaymentRecord', 'PaymentEvent', 'OperatorWallet')),
  'listing_owner_fk', (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'listings_operator_id_fkey'));

SELECT jsonb_build_object('section', 'unknown_amount_bookings', 'rows', coalesce(jsonb_agg(row_to_json(b) ORDER BY b.created_at, b.id), '[]')) FROM (
  SELECT b.id, b.listing_id, b.provider_id, b.status, b.payment_status, b.date, b.created_at,
    b.num_people, b.total_price AS legacy_total_not_authoritative, b.amount_cents, b.currency,
    CASE WHEN b.checkout_session_id ~ '^cs_(test|live)_[A-Za-z0-9]+$' THEN b.checkout_session_id END AS checkout_session_id,
    b.checkout_session_id IS NOT NULL AS checkout_reference_present,
    CASE WHEN b.payment_intent_id ~ '^pi_(?!.*_secret_)[A-Za-z0-9_]+$' THEN b.payment_intent_id END AS payment_intent_id,
    b.payment_intent_id IS NOT NULL AS intent_reference_present,
    p.id AS payment_record_id, p.status AS ledger_status, p.amount_gross_cents AS ledger_expected_amount,
    l.price_from AS current_listing_price_not_historical, l.currency AS current_listing_currency,
    'free_tour' = ANY(l.tags) AS current_listing_free_tag,
    (SELECT count(*) FROM listing_availability a WHERE a.listing_id=b.listing_id AND a.date::date=b.date::date) AS availability_rows
  FROM bookings b LEFT JOIN "PaymentRecord" p ON p.booking_id = b.id
  JOIN listings l ON l.id=b.listing_id WHERE b.amount_cents IS NULL
) b;

SELECT jsonb_build_object('section', 'ledger', 'rows', coalesce(jsonb_agg(row_to_json(p)), '[]')) FROM (
  SELECT p.id, p.booking_id, p.provider_id, p.status, p.amount_gross_cents, p.amount_net_cents,
    p.commission_cents, p.currency, p.created_at, p.updated_at,
    CASE WHEN p.stripe_checkout_session_id ~ '^cs_(test|live)_[A-Za-z0-9]+$' THEN p.stripe_checkout_session_id END AS checkout_session_id,
    CASE WHEN p.stripe_payment_intent_id ~ '^pi_(?!.*_secret_)[A-Za-z0-9_]+$' THEN p.stripe_payment_intent_id END AS payment_intent_id,
    b.status AS booking_status, b.payment_status AS booking_payment_status, b.amount_cents AS booking_expected_amount,
    b.total_price AS booking_legacy_total, b.currency AS booking_currency, b.num_people, b.date AS booking_date
  FROM "PaymentRecord" p LEFT JOIN bookings b ON b.id=p.booking_id
) p;

SELECT jsonb_build_object('section', 'events', 'rows', coalesce(jsonb_agg(row_to_json(e)), '[]')) FROM (
  SELECT e.id, e.type, e.created_at, e.processed_at,
    to_jsonb(e)->>'status' AS stored_processing_status,
    to_jsonb(e)->>'attempts' AS attempts, to_jsonb(e)->>'last_attempt_at' AS last_attempt_at,
    (to_jsonb(e)->>'error_category') IS NOT NULL AS error_category_present,
    to_jsonb(e)->>'booking_id' AS stored_booking_id, to_jsonb(e)->>'payment_record_id' AS stored_payment_record_id,
    jsonb_typeof(e.payload) AS payload_type,
    CASE WHEN e.payload->>'livemode' IN ('true','false') THEN e.payload->>'livemode' ELSE 'UNKNOWN' END AS payload_livemode,
    e.payload->>'id' = e.id AS root_id_matches,
    e.payload ? 'data' AS has_data, e.payload ? 'object' AS has_root_object,
    e.payload #> '{data,object}' IS NOT NULL AS has_data_object,
    CASE WHEN e.payload #>> '{data,object,id}' ~ '^(pi_|cs_(test|live)_)[A-Za-z0-9]+$' THEN e.payload #>> '{data,object,id}' END AS object_id,
    CASE WHEN e.payload #>> '{data,object,payment_intent}' ~ '^pi_(?!.*_secret_)[A-Za-z0-9_]+$' THEN e.payload #>> '{data,object,payment_intent}' END AS object_payment_intent,
    CASE WHEN e.payload #>> '{data,object,metadata,booking_id}' ~ '^[A-Za-z0-9_-]{1,100}$' THEN e.payload #>> '{data,object,metadata,booking_id}' END AS metadata_booking_id,
    CASE WHEN e.payload #>> '{data,object,metadata,payment_record_id}' ~ '^[A-Za-z0-9_-]{1,100}$' THEN e.payload #>> '{data,object,metadata,payment_record_id}' END AS metadata_payment_record_id,
    CASE WHEN e.payload #>> '{data,object,livemode}' IN ('true','false') THEN e.payload #>> '{data,object,livemode}' ELSE 'UNKNOWN' END AS object_livemode,
    CASE WHEN jsonb_typeof(e.payload #> '{data,object,amount_total}') = 'number' THEN e.payload #> '{data,object,amount_total}' END AS payload_amount_total_not_verified,
    CASE WHEN e.payload #>> '{data,object,currency}' ~ '^[A-Za-z]{3}$' THEN e.payload #>> '{data,object,currency}' END AS payload_currency_not_verified,
    CASE WHEN e.payload #>> '{data,object,payment_status}' IN ('paid','unpaid','no_payment_required') THEN e.payload #>> '{data,object,payment_status}' END AS payload_payment_status_not_verified,
    e.payload #> '{data,object,customer_details}' IS NOT NULL AS customer_details_present,
    e.payload #> '{data,object,client_secret}' IS NOT NULL AS client_secret_present
  FROM "PaymentEvent" e
) e;

SELECT jsonb_build_object('section', 'unbacked_confirmation', 'rows', coalesce(jsonb_agg(row_to_json(b)), '[]')) FROM (
  SELECT b.id, b.listing_id, b.provider_id, b.status, b.payment_status, b.amount_cents, b.total_price,
    b.currency, b.num_people, b.date, b.created_at, to_jsonb(b)->>'updated_at' AS updated_at,
    to_jsonb(b)->>'inventory_state' AS inventory_state,
    b.checkout_session_id IS NOT NULL AS checkout_reference_present,
    b.payment_intent_id IS NOT NULL AS intent_reference_present,
    p.id AS payment_record_id, p.status AS ledger_status, p.amount_gross_cents AS ledger_expected_amount,
    to_jsonb(p)->>'amount_charged_cents' AS charged_amount,
    l.price_from AS current_listing_price_not_historical, 'free_tour' = ANY(l.tags) AS current_listing_free_tag,
    (SELECT count(*) FROM listing_availability a WHERE a.listing_id=b.listing_id AND a.date::date=b.date::date) AS availability_rows
  FROM bookings b LEFT JOIN "PaymentRecord" p ON p.booking_id=b.id JOIN listings l ON l.id=b.listing_id
  WHERE b.status IN ('confirmed', 'completed') AND (b.amount_cents IS NULL OR b.amount_cents<>0)
    AND (p.id IS NULL OR lower(btrim(p.status)) NOT IN ('paid','succeeded'))
) b;

SELECT jsonb_build_object('section', 'public_listings', 'rows', coalesce(jsonb_agg(row_to_json(l) ORDER BY l.id), '[]')) FROM (
  SELECT l.id, l.provider_id, l.status, l.price_from, l.currency,
    'free_tour' = ANY(l.tags) AS free_tag, l.duration_minutes, l.start_date, l.end_date,
    l.operator_id IS NOT NULL AS listing_owner_present, l.operator_id=p.user_id AS owner_matches_provider,
    nullif(btrim(l.description),'') IS NOT NULL AS description_present,
    nullif(btrim(l.cover_image_url),'') IS NOT NULL AS cover_present,
    p.status AS provider_status, p.verified_level, p.approved_at,
    p.user_id IS NOT NULL AS provider_owner_present,
    nullif(btrim(p.email),'') IS NOT NULL AS operational_email_present,
    nullif(btrim(p.phone),'') IS NOT NULL AS operational_phone_present,
    nullif(btrim(p.stripe_account_id),'') IS NOT NULL AS stripe_account_reference_present,
    (SELECT count(*) FROM listing_availability a WHERE a.listing_id=l.id) AS availability_rows,
    (SELECT max(a.spots_total) FROM listing_availability a WHERE a.listing_id=l.id) AS declared_capacity
  FROM listings l JOIN providers p ON p.id=l.provider_id WHERE l.status IN ('published','approved')
) l;

SELECT jsonb_build_object('section', 'booking_summary', 'rows', jsonb_agg(row_to_json(b))) FROM (
  SELECT status, payment_status, count(*) AS count, count(*) FILTER (WHERE amount_cents IS NULL) AS unknown_amount,
    count(*) FILTER (WHERE date::date < CURRENT_DATE) AS past_date, min(created_at) AS first_created, max(created_at) AS last_created
  FROM bookings GROUP BY status,payment_status
) b;

SELECT jsonb_build_object('section', 'wallet_summary', 'rows', count(*),
  'total_earned_local_not_verified', sum("totalEarned"), 'total_released_local_not_verified', sum("totalReleased"),
  'pending_payouts_local_not_verified', sum("pendingPayouts"), 'commission_local_not_verified', sum(commission))
FROM "OperatorWallet";
COMMIT;
