-- AlterTable
ALTER TABLE "public"."Registration" ADD COLUMN     "review_reason" TEXT,
ADD COLUMN     "review_status" "public"."ReviewStatus" NOT NULL DEFAULT 'ok';

-- CreateIndex
CREATE INDEX "Registration_review_status_idx" ON "public"."Registration"("review_status");
