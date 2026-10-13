-- Additive. NULL history remains unknown; no inferred modes or reference backfill.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE "PaymentRecord" ADD COLUMN "processor_mode" TEXT;
ALTER TABLE "PaymentEvent" ADD COLUMN "processor_mode" TEXT;
ALTER TABLE "providers" ADD COLUMN "stripe_test_account_id" TEXT;
ALTER TABLE "providers" ADD COLUMN "stripe_live_account_id" TEXT;
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "payment_processor_mode_valid"
  CHECK ("processor_mode" IS NULL OR "processor_mode" IN ('test', 'live'));
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "payment_event_processor_mode_valid"
  CHECK ("processor_mode" IS NULL OR "processor_mode" IN ('test', 'live'));
ALTER TABLE "providers" ADD CONSTRAINT "provider_mode_account_ids_valid"
  CHECK (("stripe_test_account_id" IS NULL OR "stripe_test_account_id" ~ '^acct_[A-Za-z0-9]+$')
    AND ("stripe_live_account_id" IS NULL OR "stripe_live_account_id" ~ '^acct_[A-Za-z0-9]+$')
    AND ("stripe_test_account_id" IS NULL OR "stripe_live_account_id" IS NULL
      OR "stripe_test_account_id" <> "stripe_live_account_id"));
CREATE UNIQUE INDEX "providers_stripe_test_account_id_key" ON "providers"("stripe_test_account_id");
CREATE UNIQUE INDEX "providers_stripe_live_account_id_key" ON "providers"("stripe_live_account_id");
CREATE INDEX "idx_payment_mode_refund"
  ON "PaymentRecord"("processor_mode", "refund_status", "refund_next_attempt_at");
COMMIT;
