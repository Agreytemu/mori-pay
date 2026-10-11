UPDATE "FeeRule"
SET "active" = FALSE
WHERE ("type" = 'deposit' AND "channel" = 'card')
   OR ("type" = 'withdrawal' AND "channel" = 'mobileMoney');

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
    (
        'fee-card-deposit-20261014',
        'deposit',
        'card',
        0,
        0.045,
        0,
        NULL,
        TRUE
    ),
    (
        'fee-mobile-withdrawal-20261014',
        'withdrawal',
        'mobileMoney',
        0,
        0.025,
        0,
        NULL,
        TRUE
    );
