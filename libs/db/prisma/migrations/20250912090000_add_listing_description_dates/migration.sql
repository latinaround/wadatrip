-- Extend listings with description and date range fields
ALTER TABLE "listings"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "start_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMP(3);

