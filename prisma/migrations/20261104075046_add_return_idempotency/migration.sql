/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `SaleReturn` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SaleReturn" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "SaleReturn" ADD COLUMN "returnRequestHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturn_idempotencyKey_key" ON "SaleReturn"("idempotencyKey");
