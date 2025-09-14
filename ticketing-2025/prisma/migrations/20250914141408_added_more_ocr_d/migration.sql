/*
  Warnings:

  - You are about to drop the column `ocr_checked_at` on the `Registration` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Registration" DROP COLUMN "ocr_checked_at",
ADD COLUMN     "ocr_expected_amount" INTEGER;
