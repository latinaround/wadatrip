-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "amount_cents" INTEGER,
ADD COLUMN     "checkout_session_id" TEXT,
ADD COLUMN     "commission_cents" INTEGER,
ADD COLUMN     "currency" TEXT DEFAULT 'usd',
ADD COLUMN     "operator_share_cents" INTEGER,
ADD COLUMN     "payment_intent_id" TEXT;

-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "extracted_country" TEXT,
ADD COLUMN     "extracted_id_number" TEXT,
ADD COLUMN     "match_faces" BOOLEAN DEFAULT false,
ADD COLUMN     "verification_notes" TEXT;

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "amount_gross_cents" INTEGER NOT NULL,
    "commission_cents" INTEGER NOT NULL,
    "amount_net_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "stripe_payment_intent_id" TEXT,
    "stripe_checkout_session_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorWallet" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "totalReleased" INTEGER NOT NULL DEFAULT 0,
    "pendingPayouts" INTEGER NOT NULL DEFAULT 0,
    "commission" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_booking_id_key" ON "PaymentRecord"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorWallet_operatorId_key" ON "OperatorWallet"("operatorId");
