-- CreateEnum
CREATE TYPE "public"."MemberType" AS ENUM ('single', 'family');

-- CreateTable
CREATE TABLE "public"."Member" (
    "id" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "type" "public"."MemberType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_name_key_key" ON "public"."Member"("name_key");

-- CreateIndex
CREATE INDEX "Member_type_idx" ON "public"."Member"("type");
