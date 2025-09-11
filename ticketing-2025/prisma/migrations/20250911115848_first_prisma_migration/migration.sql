-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('pending', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "public"."TicketStatus" AS ENUM ('not_issued', 'issued', 'used');

-- CreateTable
CREATE TABLE "public"."Registration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tickets_standing" INTEGER NOT NULL DEFAULT 0,
    "tickets_chair" INTEGER NOT NULL DEFAULT 0,
    "tickets_children" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL,
    "proof_url" TEXT NOT NULL,
    "invoice_sent" BOOLEAN NOT NULL DEFAULT false,
    "payment_status" "public"."PaymentStatus" NOT NULL DEFAULT 'pending',
    "ticket_status" "public"."TicketStatus" NOT NULL DEFAULT 'not_issued',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);
