-- WS-C: scope idempotency keys to the owning user so two accounts can never
-- collide on the same key (and a replay can never return another user's row).
DROP INDEX "Transaction_idempotencyKey_key";

CREATE UNIQUE INDEX "Transaction_userId_idempotencyKey_key"
    ON "Transaction"("userId", "idempotencyKey");

-- WS-C: persist the applied fee breakdown alongside the total fee so a
-- transaction is self-describing after the underlying FeeRule changes.
ALTER TABLE "Transaction"
    ADD COLUMN "feeFlat" BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN "feePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0;
