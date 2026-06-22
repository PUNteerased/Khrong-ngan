-- AlterTable
ALTER TABLE "PickupTicket" ADD COLUMN "messageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PickupTicket_messageId_key" ON "PickupTicket"("messageId");

-- AddForeignKey
ALTER TABLE "PickupTicket" ADD CONSTRAINT "PickupTicket_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
