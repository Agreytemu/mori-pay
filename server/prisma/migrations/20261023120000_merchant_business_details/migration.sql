-- Expand merchant applications with the full Tanzanian business-detail set.
ALTER TABLE "MerchantApplication"
  ADD COLUMN IF NOT EXISTS "businessType" TEXT,
  ADD COLUMN IF NOT EXISTS "tin" TEXT,
  ADD COLUMN IF NOT EXISTS "businessLicenceNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "region" TEXT,
  ADD COLUMN IF NOT EXISTS "district" TEXT,
  ADD COLUMN IF NOT EXISTS "physicalAddress" TEXT;
