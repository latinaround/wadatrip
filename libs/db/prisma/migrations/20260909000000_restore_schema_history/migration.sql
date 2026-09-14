-- Recover existing schema declarations previously left outside Prisma migration directories.
-- This precedes payment_lifecycle; existing migration checksums remain unchanged.
-- Stop old writers and run on an authorized copy first. Never run the loose full-schema SQL.
-- Unknown historical money/references stay NULL. No business rows are removed or inferred.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- IF NOT EXISTS is followed by catalog validation below, never treated as compatibility proof.
CREATE TABLE IF NOT EXISTS "PaymentRecord" (
  id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, provider_id TEXT NOT NULL,
  amount_gross_cents INTEGER, commission_cents INTEGER, amount_net_cents INTEGER,
  currency TEXT, stripe_payment_intent_id TEXT, stripe_checkout_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL
);
CREATE TABLE IF NOT EXISTS "PaymentEvent" (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, payload JSONB NOT NULL,
  processed_at TIMESTAMP(3), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "OperatorWallet" (
  id TEXT PRIMARY KEY, "operatorId" TEXT NOT NULL,
  "totalEarned" INTEGER NOT NULL DEFAULT 0, "totalReleased" INTEGER NOT NULL DEFAULT 0,
  "pendingPayouts" INTEGER NOT NULL DEFAULT 0, commission INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS destination_covers (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL, city TEXT NOT NULL, country_code TEXT,
  title TEXT, image_url TEXT NOT NULL, eyebrow TEXT, active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
LOCK TABLE users, providers, listings, bookings, itineraries,
  "PaymentRecord", "PaymentEvent", "OperatorWallet", destination_covers IN ACCESS EXCLUSIVE MODE;

-- Exact storage types matter (especially timestamp without timezone and minor-unit integers).
-- Existing columns are checked, not silently replaced, cast or backfilled.
CREATE FUNCTION pg_temp.revenue_column(tab TEXT, col TEXT, typ TEXT, required BOOLEAN,
  default_sql TEXT DEFAULT NULL, may_add BOOLEAN DEFAULT true) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE actual RECORD;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) AS typ, a.attnotnull AS required,
    a.attgenerated, a.attidentity INTO actual
    FROM pg_attribute a WHERE a.attrelid = format('public.%I', tab)::regclass
      AND a.attname = col AND a.attnum > 0 AND NOT a.attisdropped;
  IF FOUND THEN
    IF actual.typ <> typ OR (required AND NOT actual.required)
      OR actual.attgenerated <> '' OR actual.attidentity <> '' THEN
      RAISE EXCEPTION 'Incompatible schema: %.%; investigate before migration', tab, col;
    END IF;
  ELSIF NOT may_add THEN
    RAISE EXCEPTION 'Incomplete existing table: %.%; investigate before migration', tab, col;
  ELSE
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s%s%s', tab, col, typ,
      CASE WHEN required THEN ' NOT NULL' ELSE '' END,
      CASE WHEN default_sql IS NOT NULL THEN ' DEFAULT ' || default_sql ELSE '' END);
  END IF;
END $$;

SELECT pg_temp.revenue_column('users', 'password_hash', 'text', false);
SELECT pg_temp.revenue_column('users', 'last_login_at', 'timestamp(3) without time zone', false);
-- Existing auth contract defaults grant no administrative privilege.
SELECT pg_temp.revenue_column('users', 'role', 'text', true, '''traveler''');
SELECT pg_temp.revenue_column('users', 'status', 'text', true, '''active''');

SELECT pg_temp.revenue_column('providers', 'photo_url', 'text', false);
SELECT pg_temp.revenue_column('providers', 'bio_short', 'text', false);
SELECT pg_temp.revenue_column('providers', 'verified_level', 'text', true, '''community''');
SELECT pg_temp.revenue_column('providers', 'license_url', 'text', false);
SELECT pg_temp.revenue_column('providers', 'approved_at', 'timestamp(3) without time zone', false);
SELECT pg_temp.revenue_column('providers', 'approved_by', 'text', false);
SELECT pg_temp.revenue_column('providers', 'verification_status', 'text', false);
SELECT pg_temp.revenue_column('providers', 'verification_score', 'double precision', false);
SELECT pg_temp.revenue_column('providers', 'risk_level', 'text', false);
SELECT pg_temp.revenue_column('providers', 'detected_name', 'text', false);
SELECT pg_temp.revenue_column('providers', 'document_valid', 'boolean', false);
SELECT pg_temp.revenue_column('providers', 'extracted_country', 'text', false);
SELECT pg_temp.revenue_column('providers', 'extracted_id_number', 'text', false);
SELECT pg_temp.revenue_column('providers', 'match_faces', 'boolean', false);
SELECT pg_temp.revenue_column('providers', 'verification_notes', 'text', false);
-- Future inserts follow existing schema defaults; do not invent historical verification results.
ALTER TABLE providers ALTER COLUMN verification_status SET DEFAULT 'pending',
  ALTER COLUMN document_valid SET DEFAULT false, ALTER COLUMN match_faces SET DEFAULT false;
SELECT pg_temp.revenue_column('listings', 'operator_id', 'text', false);
SELECT pg_temp.revenue_column('listings', 'cover_image_url', 'text', false);
SELECT pg_temp.revenue_column('bookings', 'amount_cents', 'integer', false);
SELECT pg_temp.revenue_column('bookings', 'operator_share_cents', 'integer', false);
SELECT pg_temp.revenue_column('bookings', 'commission_cents', 'integer', false);
SELECT pg_temp.revenue_column('bookings', 'currency', 'text', false);
ALTER TABLE bookings ALTER COLUMN currency SET DEFAULT 'usd';
SELECT pg_temp.revenue_column('bookings', 'checkout_session_id', 'text', false);
SELECT pg_temp.revenue_column('bookings', 'payment_intent_id', 'text', false);

-- Schema restoration only: no itinerary engine or routes are enabled.
SELECT pg_temp.revenue_column('itineraries', 'price', 'numeric(12,2)', false);
SELECT pg_temp.revenue_column('itineraries', 'currency', 'text', true, '''USD''');
SELECT pg_temp.revenue_column('itineraries', 'operator_stripe_account_id', 'text', false);

DO $$
DECLARE spec RECORD;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('PaymentRecord','id','text',true), ('PaymentRecord','booking_id','text',true),
    ('PaymentRecord','provider_id','text',true), ('PaymentRecord','amount_gross_cents','integer',false),
    ('PaymentRecord','commission_cents','integer',false), ('PaymentRecord','amount_net_cents','integer',false),
    ('PaymentRecord','currency','text',false), ('PaymentRecord','stripe_payment_intent_id','text',false),
    ('PaymentRecord','stripe_checkout_session_id','text',false), ('PaymentRecord','status','text',true),
    ('PaymentRecord','created_at','timestamp(3) without time zone',true),
    ('PaymentRecord','updated_at','timestamp(3) without time zone',true),
    ('PaymentEvent','id','text',true), ('PaymentEvent','type','text',true),
    ('PaymentEvent','payload','jsonb',true), ('PaymentEvent','processed_at','timestamp(3) without time zone',false),
    ('PaymentEvent','created_at','timestamp(3) without time zone',true),
    ('OperatorWallet','id','text',true), ('OperatorWallet','operatorId','text',true),
    ('OperatorWallet','totalEarned','integer',true), ('OperatorWallet','totalReleased','integer',true),
    ('OperatorWallet','pendingPayouts','integer',true), ('OperatorWallet','commission','integer',true),
    ('OperatorWallet','updatedAt','timestamp(3) without time zone',true),
    ('OperatorWallet','createdAt','timestamp(3) without time zone',true),
    ('destination_covers','id','text',true), ('destination_covers','slug','text',true),
    ('destination_covers','city','text',true), ('destination_covers','country_code','text',false),
    ('destination_covers','title','text',false), ('destination_covers','image_url','text',true),
    ('destination_covers','eyebrow','text',false), ('destination_covers','active','boolean',true),
    ('destination_covers','created_at','timestamp(3) without time zone',true)
  ) AS contract(tab,col,typ,required) LOOP
    PERFORM pg_temp.revenue_column(spec.tab, spec.col, spec.typ, spec.required, NULL, false);
  END LOOP;
  FOR spec IN SELECT unnest(ARRAY['PaymentRecord','PaymentEvent','OperatorWallet','destination_covers']) AS tab LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', spec.tab)::regclass AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) = 'PRIMARY KEY (id)') THEN
      RAISE EXCEPTION 'Incompatible primary key: %', spec.tab;
    END IF;
  END LOOP;
END $$;

-- Deterministic index validation prevents a same-name incompatible index hiding corruption.
CREATE FUNCTION pg_temp.revenue_index(idx TEXT, tab TEXT, cols TEXT, is_unique BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE expected TEXT; actual TEXT;
BEGIN
  expected := format('CREATE %sINDEX %I ON public.%I USING btree (%s)',
    CASE WHEN is_unique THEN 'UNIQUE ' ELSE '' END, idx, tab, cols);
  SELECT pg_get_indexdef(i.indexrelid) INTO actual FROM pg_index i
    WHERE i.indexrelid = to_regclass(format('public.%I', idx)) AND i.indisvalid AND i.indisready;
  IF actual IS NOT NULL THEN
    IF actual <> expected THEN RAISE EXCEPTION 'Incompatible index: %', idx; END IF;
  ELSE
    EXECUTE expected;
  END IF;
END $$;
SELECT pg_temp.revenue_index('PaymentRecord_booking_id_key','PaymentRecord','booking_id',true);
SELECT pg_temp.revenue_index('OperatorWallet_operatorId_key','OperatorWallet','"operatorId"',true);
SELECT pg_temp.revenue_index('destination_covers_slug_key','destination_covers','slug',true);
SELECT pg_temp.revenue_index('idx_destination_covers_city_country_active','destination_covers','city, country_code, active',false);
SELECT pg_temp.revenue_index('idx_destination_covers_active','destination_covers','active',false);
SELECT pg_temp.revenue_index('idx_listings_operator','listings','operator_id',false);
SELECT pg_temp.revenue_index('idx_listings_status','listings','status',false);
DO $$
DECLARE actual TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO actual FROM pg_constraint
    WHERE conrelid = 'listings'::regclass AND conname = 'listings_operator_id_fkey';
  IF actual IS NULL THEN
    ALTER TABLE listings ADD CONSTRAINT listings_operator_id_fkey FOREIGN KEY (operator_id)
      REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  ELSIF actual NOT IN (
    'FOREIGN KEY (operator_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL',
    'FOREIGN KEY (operator_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID') THEN
    RAISE EXCEPTION 'Incompatible listings_operator_id_fkey';
  END IF;
END $$;
COMMIT;
