-- Additive read receipts only. Existing bookings, payments, inventory and emails are unchanged.
-- Existing confirmed reservations start unreviewed; no historical review is fabricated.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

CREATE TABLE "operator_booking_reviews" (
  "booking_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operator_booking_reviews_pkey" PRIMARY KEY ("booking_id", "user_id"),
  CONSTRAINT "operator_booking_reviews_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "operator_booking_reviews_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "operator_booking_reviews_user_id_reviewed_at_idx"
  ON "operator_booking_reviews"("user_id", "reviewed_at");
COMMIT;
