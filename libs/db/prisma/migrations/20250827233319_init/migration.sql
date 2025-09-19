-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itineraries" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "pax" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itineraries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_versions" (
    "id" TEXT NOT NULL,
    "itinerary_id" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "total_price" DECIMAL(12,2),
    "adred_action" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diff_from_prev" JSONB,

    CONSTRAINT "itinerary_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_items" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "supplier" TEXT,
    "provider" TEXT,
    "title" TEXT,
    "start_ts" TIMESTAMP(3),
    "end_ts" TIMESTAMP(3),
    "geo" JSONB,
    "price" DECIMAL(12,2),
    "currency" TEXT,
    "details" JSONB,

    CONSTRAINT "itinerary_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "itinerary_id" TEXT,
    "rule" JSONB NOT NULL,
    "channel" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adred_predictions" (
    "id" TEXT NOT NULL,
    "route_key" TEXT NOT NULL,
    "date_bucket" TIMESTAMP(3) NOT NULL,
    "current_price" DECIMAL(12,2),
    "predicted_low" DECIMAL(12,2),
    "action" TEXT,
    "confidence" DOUBLE PRECISION,
    "horizon_days" INTEGER,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adred_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_itin_owner" ON "itineraries"("owner_id");

-- CreateIndex
CREATE INDEX "idx_itin_dest_date" ON "itineraries"("destination", "start_date");

-- CreateIndex
CREATE INDEX "idx_items_version" ON "itinerary_versions"("itinerary_id", "scenario");

-- CreateIndex
CREATE INDEX "idx_items_version_fk" ON "itinerary_items"("version_id");

-- CreateIndex
CREATE INDEX "idx_alerts_user" ON "alert_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "idx_alerts_itinerary" ON "alert_subscriptions"("itinerary_id");

-- CreateIndex
CREATE INDEX "idx_alerts_active" ON "alert_subscriptions"("active");

-- CreateIndex
CREATE INDEX "idx_alerts_status" ON "alerts"("subscription_id", "status");

-- CreateIndex
CREATE INDEX "idx_adred_route_date" ON "adred_predictions"("route_key", "date_bucket");

-- AddForeignKey
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_versions" ADD CONSTRAINT "itinerary_versions_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "itinerary_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_subscriptions" ADD CONSTRAINT "alert_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_subscriptions" ADD CONSTRAINT "alert_subscriptions_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "alert_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
