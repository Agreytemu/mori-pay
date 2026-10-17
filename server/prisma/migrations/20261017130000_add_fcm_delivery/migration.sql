CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
    'pending',
    'processing',
    'accepted',
    'failed'
);

WITH ranked_tokens AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "pushToken"
            ORDER BY "lastActiveAt" DESC, "createdAt" DESC, "id" DESC
        ) AS token_rank
    FROM "Device"
    WHERE "pushToken" IS NOT NULL
)
UPDATE "Device"
SET "pushToken" = NULL
WHERE "id" IN (
    SELECT "id"
    FROM ranked_tokens
    WHERE token_rank > 1
);

CREATE UNIQUE INDEX "Device_pushToken_key"
    ON "Device"("pushToken");

CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationDelivery_notificationId_deviceId_key"
    ON "NotificationDelivery"("notificationId", "deviceId");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx"
    ON "NotificationDelivery"("status", "nextAttemptAt");
CREATE INDEX "NotificationDelivery_deviceId_idx"
    ON "NotificationDelivery"("deviceId");

ALTER TABLE "NotificationDelivery"
    ADD CONSTRAINT "NotificationDelivery_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "Notification"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery"
    ADD CONSTRAINT "NotificationDelivery_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Device"
    ADD COLUMN "clientApp" TEXT NOT NULL DEFAULT 'mobile';
