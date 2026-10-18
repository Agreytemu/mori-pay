ALTER TABLE "PaymentProviderSettings"
  ADD COLUMN "mobileMoneyEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "bankEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "cardEnabled" BOOLEAN NOT NULL DEFAULT true;
