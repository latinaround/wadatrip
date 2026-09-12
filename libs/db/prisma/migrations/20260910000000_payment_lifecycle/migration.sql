-- Run scripts/payment-preflight.sql first against an authorized copy.
-- Drain old writers before applying; mixed lifecycle versions are unsafe.
-- No historical financial/business values are guessed, deleted or rewritten.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
LOCK TABLE listings, bookings, listing_availability, "PaymentRecord", "PaymentEvent" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM listing_availability GROUP BY listing_id, date::date HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Preflight failed: duplicate availability days; investigate without merging automatically';
  END IF;
  IF EXISTS (SELECT 1 FROM (
    SELECT 'intent' kind, stripe_payment_intent_id ref, booking_id FROM "PaymentRecord"
    UNION ALL SELECT 'intent', payment_intent_id, id FROM bookings
    UNION ALL SELECT 'session', stripe_checkout_session_id, booking_id FROM "PaymentRecord"
    UNION ALL SELECT 'session', checkout_session_id, id FROM bookings
  ) refs WHERE ref IS NOT NULL GROUP BY kind, ref HAVING count(DISTINCT booking_id) > 1) THEN
    RAISE EXCEPTION 'Preflight failed: external reference assigned to multiple bookings';
  END IF;
END $$;
ALTER TABLE bookings ADD COLUMN inventory_state TEXT;
ALTER TABLE "PaymentRecord"
  ALTER COLUMN "amount_gross_cents" DROP NOT NULL,
  ALTER COLUMN "commission_cents" DROP NOT NULL,
  ALTER COLUMN "amount_net_cents" DROP NOT NULL,
  ALTER COLUMN "currency" DROP NOT NULL,
  ADD COLUMN "processor" TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN "flow" TEXT,
  ADD COLUMN "request_payload" JSONB,
  ADD COLUMN "resolution" TEXT,
  ADD COLUMN "resolution_reason" TEXT,
  ADD COLUMN "amount_charged_cents" INTEGER,
  ADD COLUMN "charged_currency" TEXT;
ALTER TABLE "PaymentEvent"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'received',
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_attempt_at" TIMESTAMP(3),
  ADD COLUMN "error_category" TEXT,
  ADD COLUMN "booking_id" TEXT,
  ADD COLUMN "payment_record_id" TEXT;
-- Completion metadata derived solely from the existing completion timestamp.
UPDATE "PaymentEvent" SET "status" = 'processed' WHERE processed_at IS NOT NULL;
CREATE UNIQUE INDEX "PaymentRecord_stripe_payment_intent_id_key" ON "PaymentRecord"("stripe_payment_intent_id");
CREATE UNIQUE INDEX "PaymentRecord_stripe_checkout_session_id_key" ON "PaymentRecord"("stripe_checkout_session_id");
CREATE UNIQUE INDEX "bookings_payment_intent_id_key" ON bookings(payment_intent_id);
CREATE UNIQUE INDEX "bookings_checkout_session_id_key" ON bookings(checkout_session_id);
-- Prisma DateTime is timestamp(3) without time zone; application dates are UTC days.
CREATE UNIQUE INDEX "listing_availability_listing_day_key" ON listing_availability(listing_id, (date::date));
CREATE INDEX "idx_bookings_listing_date" ON bookings(listing_id, date);
CREATE INDEX "PaymentRecord_resolution_updated_at_idx" ON "PaymentRecord"("resolution", "updated_at");
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "payment_flow_valid" CHECK ("flow" IS NULL OR "flow" IN ('checkout', 'intent'));
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "payment_resolution_valid" CHECK ("resolution" IS NULL OR "resolution" IN ('refund_required', 'reconciliation_required'));
CREATE INDEX "PaymentEvent_booking_id_created_at_idx" ON "PaymentEvent"("booking_id", "created_at");
CREATE INDEX "PaymentEvent_status_last_attempt_at_idx" ON "PaymentEvent"("status", "last_attempt_at");
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
-- NOT VALID retains suspect history but enforces new writes. Investigate, then
-- explicitly VALIDATE these constraints before production activation.
ALTER TABLE bookings ADD CONSTRAINT booking_inventory_valid CHECK (inventory_state IS NULL OR inventory_state IN ('held', 'released'));
ALTER TABLE bookings ADD CONSTRAINT booking_participants_positive CHECK (num_people >= 1) NOT VALID;
ALTER TABLE listing_availability ADD CONSTRAINT availability_capacity_valid
  CHECK (spots_total >= 0 AND spots_available >= 0 AND spots_available <= spots_total) NOT VALID;
ALTER TABLE bookings ADD CONSTRAINT booking_external_ids_nonempty
  CHECK ((payment_intent_id IS NULL OR btrim(payment_intent_id) <> '') AND (checkout_session_id IS NULL OR btrim(checkout_session_id) <> '')) NOT VALID;
ALTER TABLE "PaymentRecord" ADD CONSTRAINT payment_external_ids_nonempty
  CHECK ((stripe_payment_intent_id IS NULL OR btrim(stripe_payment_intent_id) <> '') AND (stripe_checkout_session_id IS NULL OR btrim(stripe_checkout_session_id) <> '')) NOT VALID;
ALTER TABLE "PaymentRecord" ADD CONSTRAINT managed_payment_valid CHECK (flow IS NULL OR (
  status IN ('pending', 'succeeded', 'failed', 'refunded') AND
  "amount_gross_cents" IS NOT NULL AND amount_gross_cents >= 0 AND
  commission_cents IS NOT NULL AND commission_cents >= 0 AND
  amount_net_cents IS NOT NULL AND amount_net_cents >= 0 AND
  amount_gross_cents::bigint = amount_net_cents::bigint + commission_cents::bigint AND
  currency IS NOT NULL AND currency = 'usd' AND request_payload IS NOT NULL
));
ALTER TABLE "PaymentEvent" ADD CONSTRAINT payment_event_state_valid CHECK (
  status IN ('received', 'processing', 'processed', 'failed') AND attempts >= 0 AND
  ("status" = 'processed') = ("processed_at" IS NOT NULL)
);
COMMIT;
