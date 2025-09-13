/*
  Warnings:

  - You are about to drop the column `created_at` on the `Registration` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Registration" DROP COLUMN "created_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "public"."Ticket" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ticketNo" TEXT NOT NULL,
    "qrUrl" TEXT NOT NULL,
    "status" "public"."TicketStatus" NOT NULL DEFAULT 'issued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketNo_key" ON "public"."Ticket"("ticketNo");

-- CreateIndex
CREATE INDEX "Ticket_registrationId_idx" ON "public"."Ticket"("registrationId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "public"."Ticket"("status");

-- CreateIndex
CREATE INDEX "Registration_payment_status_idx" ON "public"."Registration"("payment_status");

-- CreateIndex
CREATE INDEX "Registration_createdAt_idx" ON "public"."Registration"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "public"."Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
