CREATE TYPE "UserRole" AS ENUM ('user', 'admin');
CREATE TYPE "MerchantApplicationStatus" AS ENUM (
  'pending_payment',
  'awaiting_review',
  'approved',
  'rejected'
);
CREATE TYPE "MerchantAccountStatus" AS ENUM ('active', 'suspended', 'revoked');
CREATE TYPE "MerchantQrKind" AS ENUM ('static', 'fixed');

ALTER TABLE "User"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'user';

CREATE TABLE "MerchantApplication" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "phone" TEXT,
  "status" "MerchantApplicationStatus" NOT NULL DEFAULT 'pending_payment',
  "registrationFeeAmount" BIGINT,
  "registrationPaymentId" TEXT,
  "paidAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantAccount" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "phone" TEXT,
  "status" "MerchantAccountStatus" NOT NULL DEFAULT 'active',
  "ledgerAccountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantQrCode" (
  "id" TEXT NOT NULL,
  "merchantAccountId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "kind" "MerchantQrKind" NOT NULL,
  "fixedAmount" BIGINT,
  "reusable" BOOLEAN NOT NULL DEFAULT false,
  "uses" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantQrCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantQrCode_fixed_amount_check"
    CHECK (("kind" = 'static' AND "fixedAmount" IS NULL) OR ("kind" = 'fixed' AND "fixedAmount" > 0)),
  CONSTRAINT "MerchantQrCode_expiry_check"
    CHECK ("kind" = 'static' OR "expiresAt" IS NOT NULL)
);

CREATE TABLE "MerchantConfiguration" (
  "id" TEXT NOT NULL DEFAULT 'merchant-registration',
  "registrationFeeAmount" BIGINT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantConfiguration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantConfiguration_fee_check"
    CHECK ("registrationFeeAmount" IS NULL OR "registrationFeeAmount" > 0)
);

INSERT INTO "MerchantConfiguration" ("id", "registrationFeeAmount", "updatedAt")
VALUES ('merchant-registration', NULL, CURRENT_TIMESTAMP);

CREATE UNIQUE INDEX "MerchantApplication_registrationPaymentId_key"
ON "MerchantApplication"("registrationPaymentId");
CREATE INDEX "MerchantApplication_userId_status_idx"
ON "MerchantApplication"("userId", "status");
CREATE INDEX "MerchantApplication_status_createdAt_idx"
ON "MerchantApplication"("status", "createdAt");
CREATE UNIQUE INDEX "MerchantApplication_one_active_per_user_key"
ON "MerchantApplication"("userId")
WHERE "status" IN ('pending_payment', 'awaiting_review', 'approved');

CREATE UNIQUE INDEX "MerchantAccount_applicationId_key"
ON "MerchantAccount"("applicationId");
CREATE UNIQUE INDEX "MerchantAccount_identifier_key"
ON "MerchantAccount"("identifier");
CREATE UNIQUE INDEX "MerchantAccount_ledgerAccountId_key"
ON "MerchantAccount"("ledgerAccountId");
CREATE INDEX "MerchantAccount_ownerId_status_idx"
ON "MerchantAccount"("ownerId", "status");

CREATE UNIQUE INDEX "MerchantQrCode_codeHash_key"
ON "MerchantQrCode"("codeHash");
CREATE INDEX "MerchantQrCode_merchantAccountId_revokedAt_idx"
ON "MerchantQrCode"("merchantAccountId", "revokedAt");
CREATE INDEX "MerchantQrCode_expiresAt_idx"
ON "MerchantQrCode"("expiresAt");

ALTER TABLE "MerchantApplication"
ADD CONSTRAINT "MerchantApplication_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantApplication"
ADD CONSTRAINT "MerchantApplication_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MerchantAccount"
ADD CONSTRAINT "MerchantAccount_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "MerchantApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantAccount"
ADD CONSTRAINT "MerchantAccount_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantAccount"
ADD CONSTRAINT "MerchantAccount_ledgerAccountId_fkey"
FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantQrCode"
ADD CONSTRAINT "MerchantQrCode_merchantAccountId_fkey"
FOREIGN KEY ("merchantAccountId") REFERENCES "MerchantAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
