-- Backward-compatible operator readiness fields. Existing listings remain valid
-- and must be completed before they are offered for a real booking.
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "meeting_point" TEXT;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "cancellation_policy" TEXT;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "booking_cutoff_hours" INTEGER;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "operational_contact" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'listing_booking_cutoff_nonnegative'
      AND conrelid = 'listings'::regclass
  ) THEN
    ALTER TABLE "listings"
      ADD CONSTRAINT "listing_booking_cutoff_nonnegative"
      CHECK ("booking_cutoff_hours" IS NULL OR "booking_cutoff_hours" >= 0)
      NOT VALID;
  END IF;
END $$;
