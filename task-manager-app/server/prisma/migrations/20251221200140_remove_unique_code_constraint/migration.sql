-- DropIndex
DROP INDEX "Article_code_key";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "closingTime" TEXT;
ALTER TABLE "Customer" ADD COLUMN "deliveryEndTime" TEXT;
ALTER TABLE "Customer" ADD COLUMN "deliveryStartTime" TEXT;
ALTER TABLE "Customer" ADD COLUMN "openingTime" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "acceptedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "assignedAt" DATETIME;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "assignedAt" DATETIME;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "sequence" TEXT;
