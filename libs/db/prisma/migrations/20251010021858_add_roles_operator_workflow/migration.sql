-- AlterTable
ALTER TABLE "public"."listings" ADD COLUMN     "operator_id" TEXT,
ALTER COLUMN "status" SET DEFAULT 'pending';

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'traveler',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE INDEX "idx_listings_status" ON "public"."listings"("status");

-- CreateIndex
CREATE INDEX "idx_listings_operator" ON "public"."listings"("operator_id");

-- AddForeignKey
ALTER TABLE "public"."listings" ADD CONSTRAINT "listings_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
