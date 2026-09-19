-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('COMPLETED', 'VOID', 'REFUNDED');

-- AlterTable
ALTER TABLE "FeePayment" ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedByUserId" TEXT,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED';

-- CreateIndex
CREATE INDEX "FeePayment_academyId_status_idx" ON "FeePayment"("academyId", "status");
