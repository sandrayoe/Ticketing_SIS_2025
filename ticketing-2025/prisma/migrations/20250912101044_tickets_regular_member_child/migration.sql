/*
  Warnings:

  - You are about to drop the column `tickets_chair` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `tickets_standing` on the `Registration` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Registration" DROP COLUMN "tickets_chair",
DROP COLUMN "tickets_standing";
