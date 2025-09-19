-- DropForeignKey
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_subscription_id_fkey";

-- AlterTable
ALTER TABLE "alerts" ALTER COLUMN "subscription_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "alert_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
