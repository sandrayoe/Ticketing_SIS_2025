-- AlterTable
ALTER TABLE "public"."Registration" ADD COLUMN     "member_checked_at" TIMESTAMP(3),
ADD COLUMN     "member_type_detected" "public"."MemberType",
ADD COLUMN     "ocr_amount_detected" INTEGER,
ADD COLUMN     "ocr_checked_at" TIMESTAMP(3);
