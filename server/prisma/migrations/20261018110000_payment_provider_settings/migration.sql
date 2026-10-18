CREATE TABLE "PaymentProviderSettings" (
    "id" TEXT NOT NULL DEFAULT 'payment-provider-settings',
    "ablinerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "clickpesaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "primaryProvider" TEXT NOT NULL DEFAULT 'abliner',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentProviderSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PaymentProviderSettings" ("id", "ablinerEnabled", "clickpesaEnabled", "primaryProvider")
VALUES ('payment-provider-settings', true, false, 'abliner');
