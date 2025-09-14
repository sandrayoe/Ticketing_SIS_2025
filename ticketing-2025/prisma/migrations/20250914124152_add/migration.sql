-- AlterTable
ALTER TABLE "public"."Registration" ADD COLUMN     "invoice_last_attempt" TIMESTAMP(3),
ADD COLUMN     "invoice_last_error" TEXT,
ADD COLUMN     "tickets_email_last_attempt" TIMESTAMP(3),
ADD COLUMN     "tickets_email_last_error" TEXT,
ADD COLUMN     "tickets_email_sent" BOOLEAN NOT NULL DEFAULT false;
