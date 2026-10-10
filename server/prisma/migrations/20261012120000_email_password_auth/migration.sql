DO $$
BEGIN
    IF EXISTS (
        SELECT lower("email")
        FROM "User"
        WHERE "email" IS NOT NULL
        GROUP BY lower("email")
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot add case-insensitive unique email constraint: duplicate email addresses exist';
    END IF;
END $$;

ALTER TABLE "User"
    ALTER COLUMN "phone" DROP NOT NULL,
    ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
    ADD COLUMN "passwordHash" TEXT,
    ADD COLUMN "passwordFailedCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "passwordLockedUntil" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_email_lower_key"
    ON "User" (lower("email"))
    WHERE "email" IS NOT NULL;

CREATE TABLE "EmailChallenge" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "EmailChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailChallenge_email_purpose_idx"
    ON "EmailChallenge"("email", "purpose");

ALTER TABLE "EmailChallenge"
    ADD CONSTRAINT "EmailChallenge_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
