-- Replace the configured rules for all payment rails governed by the
-- customer-fee policy. This also disables stale amount-specific rules.
UPDATE "FeeRule"
SET "active" = FALSE
WHERE ("type" = 'deposit' AND "channel" IN ('mobileMoney', 'card'))
   OR ("type" = 'withdrawal' AND "channel" IN ('mobileMoney', 'card'))
   OR ("type" = 'send' AND "channel" = 'wallet')
   OR ("type" = 'payment' AND "channel" = 'wallet');

INSERT INTO "FeeRule" (
    "id",
    "type",
    "channel",
    "flat",
    "percentage",
    "minAmount",
    "maxAmount",
    "active"
)
VALUES
    ('fee-mobile-deposit-20261016', 'deposit', 'mobileMoney', 0, 0.025, 0, NULL, TRUE),
    ('fee-card-deposit-20261016', 'deposit', 'card', 0, 0.045, 0, NULL, TRUE),
    ('fee-mobile-withdrawal-20261016', 'withdrawal', 'mobileMoney', 0, 0.025, 0, NULL, TRUE),
    ('fee-card-withdrawal-20261016', 'withdrawal', 'card', 0, 0.045, 0, NULL, FALSE)
ON CONFLICT ("id") DO UPDATE
SET "type" = EXCLUDED."type",
    "channel" = EXCLUDED."channel",
    "flat" = EXCLUDED."flat",
    "percentage" = EXCLUDED."percentage",
    "minAmount" = EXCLUDED."minAmount",
    "maxAmount" = EXCLUDED."maxAmount",
    "active" = EXCLUDED."active";
