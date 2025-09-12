-- AlterTable
ALTER TABLE "public"."Registration" ADD COLUMN     "tickets_member" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tickets_regular" INTEGER NOT NULL DEFAULT 0;
