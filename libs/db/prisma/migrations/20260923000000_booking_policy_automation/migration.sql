-- Additive only. Historical policies/refunds remain unknown; do not infer consent or refund eligibility.
ALTER TABLE listings ADD COLUMN departure_time TEXT, ADD COLUMN cancellation_policy_version TEXT;
ALTER TABLE bookings ADD COLUMN booking_terms JSONB,
  ADD COLUMN cancellation_requested_at TIMESTAMP(3),
  ADD COLUMN cancellation_refund_due BOOLEAN,
  ADD COLUMN cancellation_source TEXT;
ALTER TABLE "PaymentRecord" ADD COLUMN refund_status TEXT,
  ADD COLUMN refund_id TEXT,
  ADD COLUMN refund_first_attempt_at TIMESTAMP(3),
  ADD COLUMN refund_lease_until TIMESTAMP(3),
  ADD COLUMN refund_next_attempt_at TIMESTAMP(3),
  ADD COLUMN refund_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN refund_error_category TEXT,
  ADD COLUMN refund_request_payload JSONB;
CREATE UNIQUE INDEX "PaymentRecord_refund_id_key" ON "PaymentRecord"(refund_id);
CREATE INDEX "PaymentRecord_refund_status_refund_next_attempt_at_idx"
  ON "PaymentRecord"(refund_status, refund_next_attempt_at);
ALTER TABLE listings ADD CONSTRAINT listing_departure_time_valid
  CHECK (departure_time IS NULL OR departure_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') NOT VALID;
ALTER TABLE "PaymentRecord" ADD CONSTRAINT refund_status_valid CHECK
  (refund_status IS NULL OR refund_status IN ('requested','processing','pending','succeeded','failed','review_required')) NOT VALID;
ALTER TABLE "PaymentRecord" ADD CONSTRAINT refund_attempts_nonnegative CHECK (refund_attempts >= 0) NOT VALID;
