-- CreateTable
CREATE TABLE "operator_leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "address" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "rating" DOUBLE PRECISION,
    "reviews_count" INTEGER NOT NULL DEFAULT 0,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "source_query" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'outscraper_google_maps',
    "email" TEXT,
    "instagram" TEXT,
    "whatsapp" TEXT,
    "lead_status" TEXT NOT NULL DEFAULT 'new',
    "lead_quality" TEXT,
    "website_normalized" TEXT,
    "phone_normalized" TEXT,
    "name_normalized" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_operator_leads_city_country" ON "operator_leads"("city", "country");

-- CreateIndex
CREATE INDEX "idx_operator_leads_category" ON "operator_leads"("category");

-- CreateIndex
CREATE INDEX "idx_operator_leads_rating" ON "operator_leads"("rating");

-- CreateIndex
CREATE INDEX "idx_operator_leads_status" ON "operator_leads"("lead_status");

-- CreateIndex
CREATE INDEX "idx_operator_leads_created_at" ON "operator_leads"("created_at");

-- CreateIndex
CREATE INDEX "idx_operator_leads_website_norm" ON "operator_leads"("website_normalized");

-- CreateIndex
CREATE INDEX "idx_operator_leads_phone_norm" ON "operator_leads"("phone_normalized");

-- CreateIndex
CREATE INDEX "idx_operator_leads_name_city_country" ON "operator_leads"("name_normalized", "city", "country");
