-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "detected_name" TEXT,
ADD COLUMN     "document_valid" BOOLEAN DEFAULT false,
ADD COLUMN     "risk_level" TEXT,
ADD COLUMN     "verification_score" DOUBLE PRECISION,
ADD COLUMN     "verification_status" TEXT DEFAULT 'pending';
