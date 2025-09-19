-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "languages" TEXT[],
    "base_city" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "ratings_avg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratings_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_documents" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "duration_minutes" INTEGER,
    "price_from" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "tags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_availability" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "spots_total" INTEGER NOT NULL,
    "spots_available" INTEGER NOT NULL,

    CONSTRAINT "listing_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "providers_email_key" ON "providers"("email");

-- CreateIndex
CREATE INDEX "idx_providers_status" ON "providers"("status");

-- CreateIndex
CREATE INDEX "idx_providers_city_country" ON "providers"("base_city", "country_code");

-- CreateIndex
CREATE INDEX "idx_provider_docs_provider" ON "provider_documents"("provider_id");

-- CreateIndex
CREATE INDEX "idx_listings_provider" ON "listings"("provider_id");

-- CreateIndex
CREATE INDEX "idx_listings_search" ON "listings"("city", "country_code", "category", "status");

-- CreateIndex
CREATE INDEX "idx_listing_availability_date" ON "listing_availability"("listing_id", "date");

-- AddForeignKey
ALTER TABLE "provider_documents" ADD CONSTRAINT "provider_documents_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_availability" ADD CONSTRAINT "listing_availability_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
