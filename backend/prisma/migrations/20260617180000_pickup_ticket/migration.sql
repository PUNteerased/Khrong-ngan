-- CreateEnum
CREATE TYPE "PickupTicketStatus" AS ENUM ('ISSUED', 'REDEEMED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PickupTicket" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "drugId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "channel" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "PickupTicketStatus" NOT NULL DEFAULT 'ISSUED',
    "redeemedAt" TIMESTAMP(3),
    "signature" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PickupTicket_code_key" ON "PickupTicket"("code");

-- CreateIndex
CREATE INDEX "PickupTicket_sessionId_idx" ON "PickupTicket"("sessionId");

-- CreateIndex
CREATE INDEX "PickupTicket_status_expiresAt_idx" ON "PickupTicket"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "PickupTicket" ADD CONSTRAINT "PickupTicket_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupTicket" ADD CONSTRAINT "PickupTicket_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
