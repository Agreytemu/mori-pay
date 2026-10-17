-- CreateEnum
CREATE TYPE "KycDocumentType" AS ENUM ('nida', 'passport', 'voters_card');

-- CreateEnum
CREATE TYPE "KycSubmissionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "KycSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" "KycDocumentType" NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "documentNumberLast4" TEXT NOT NULL,
    "documentImage" TEXT NOT NULL,
    "status" "KycSubmissionStatus" NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KycSubmission_userId_status_idx" ON "KycSubmission"("userId", "status");

-- CreateIndex
CREATE INDEX "KycSubmission_status_createdAt_idx" ON "KycSubmission"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "KycSubmission" ADD CONSTRAINT "KycSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
