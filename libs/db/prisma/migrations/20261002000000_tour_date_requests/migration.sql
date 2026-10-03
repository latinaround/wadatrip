-- Additive only: no historical bookings, payments or inventory are modified.
CREATE TABLE "tour_date_requests" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "listing_id" TEXT NOT NULL REFERENCES "listings"("id") ON DELETE RESTRICT,
  "requested_date" DATE NOT NULL,
  "num_people" INTEGER NOT NULL CHECK ("num_people" BETWEEN 1 AND 100),
  "status" TEXT NOT NULL DEFAULT 'requested' CHECK ("status" IN ('requested','available','declined','cancelled')),
  "response_date" DATE,
  "responded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tour_request_response_contract" CHECK (
    ("status" = 'requested' AND "response_date" IS NULL AND "responded_at" IS NULL)
    OR ("status" = 'available' AND "response_date" IS NOT NULL AND "responded_at" IS NOT NULL)
    OR ("status" = 'declined' AND "response_date" IS NULL AND "responded_at" IS NOT NULL)
    OR "status" = 'cancelled'
  )
);
CREATE UNIQUE INDEX "tour_date_requests_user_id_listing_id_requested_date_key"
  ON "tour_date_requests"("user_id","listing_id","requested_date");
CREATE INDEX "tour_date_requests_listing_id_status_created_at_idx"
  ON "tour_date_requests"("listing_id","status","created_at");
CREATE INDEX "tour_date_requests_user_id_status_created_at_idx"
  ON "tour_date_requests"("user_id","status","created_at");

CREATE TABLE "tour_request_notifications" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "request_id" TEXT NOT NULL REFERENCES "tour_date_requests"("id") ON DELETE RESTRICT,
  "audience" TEXT NOT NULL CHECK ("audience" IN ('operator','traveler')),
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','sent','failed','skipped')),
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" BETWEEN 0 AND 5),
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_until" TIMESTAMP(3),
  "claim_id" TEXT,
  "last_error" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "tour_request_notifications_request_id_audience_key"
  ON "tour_request_notifications"("request_id","audience");
CREATE INDEX "tour_request_notifications_status_next_attempt_at_idx"
  ON "tour_request_notifications"("status","next_attempt_at");
