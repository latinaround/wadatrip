CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "travelers" INTEGER NOT NULL DEFAULT 1,
    "budget" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "interests" TEXT[] NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trip_experiences" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'traveler',
    "status" TEXT NOT NULL DEFAULT 'saved',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_experiences_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "bookings" ADD COLUMN "trip_id" TEXT;

CREATE UNIQUE INDEX "trip_experiences_trip_id_listing_id_key" ON "trip_experiences"("trip_id", "listing_id");
CREATE INDEX "idx_trips_user_status" ON "trips"("user_id", "status");
CREATE INDEX "idx_trips_destination_date" ON "trips"("destination", "start_date");
CREATE INDEX "idx_trip_experiences_listing" ON "trip_experiences"("listing_id");
CREATE INDEX "idx_bookings_trip" ON "bookings"("trip_id");

ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_experiences" ADD CONSTRAINT "trip_experiences_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_experiences" ADD CONSTRAINT "trip_experiences_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;