-- Add stripe_account_id to providers
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "stripe_account_id" TEXT;

-- Create bookings table
CREATE TABLE IF NOT EXISTS "bookings" (
  "id" TEXT NOT NULL,
  "listing_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "date" TIMESTAMP(3) NOT NULL,
  "num_people" INTEGER NOT NULL,
  "total_price" DECIMAL(12,2),
  "payment_status" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_bookings_provider_status_date" ON "bookings" ("provider_id", "status", "date");
CREATE INDEX IF NOT EXISTS "idx_bookings_user_status" ON "bookings" ("user_id", "status");

-- FKs
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

