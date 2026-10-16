-- Additive: records when a withdrawal was last handed to the provider so a
-- crashed or timed-out submission can be retried after the stale window
-- without overlapping another attempt.
ALTER TABLE "Transaction" ADD COLUMN "providerSubmissionAt" TIMESTAMP(3);
