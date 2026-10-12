-- Additive booking notification outbox. No historical email is fabricated or replayed.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

CREATE TABLE "booking_notifications" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "source_event_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_until" TIMESTAMP(3),
  "claim_id" TEXT,
  "last_error" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_notifications_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "booking_notifications_kind_check" CHECK ("kind" IN ('confirmed', 'cancelled')),
  CONSTRAINT "booking_notifications_audience_check" CHECK ("audience" IN ('traveler', 'operator')),
  CONSTRAINT "booking_notifications_status_check" CHECK ("status" IN ('pending', 'sent', 'failed', 'skipped')),
  CONSTRAINT "booking_notifications_attempts_check" CHECK ("attempts" >= 0)
);

CREATE UNIQUE INDEX "booking_notifications_booking_id_kind_audience_key"
  ON "booking_notifications"("booking_id", "kind", "audience");
CREATE INDEX "booking_notifications_status_next_attempt_at_idx"
  ON "booking_notifications"("status", "next_attempt_at");
CREATE INDEX "booking_notifications_booking_id_created_at_idx"
  ON "booking_notifications"("booking_id", "created_at");

COMMIT;
