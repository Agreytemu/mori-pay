export type AccountTierName = 'Standard' | 'Verified';

export type TierLimits = {
  /** Rolling 24-hour outflow ceiling, in whole TZS. */
  dailyOutflow: bigint;
  /** Largest single outflow, in whole TZS. */
  perTransaction: bigint;
};

/**
 * Proposed default tiers. These are conservative placeholders until product
 * signs off real AML thresholds; every value is overridable with the
 * `LIMIT_STANDARD_*` / `LIMIT_VERIFIED_*` environment variables.
 *
 * - Standard:  1,000,000 TZS / day, 500,000 TZS per transaction
 * - Verified:  5,000,000 TZS / day, 3,000,000 TZS per transaction
 */
export const DEFAULT_TIER_LIMITS: Record<AccountTierName, TierLimits> = {
  Standard: { dailyOutflow: 1_000_000n, perTransaction: 500_000n },
  Verified: { dailyOutflow: 5_000_000n, perTransaction: 3_000_000n },
};

export type LimitsSummary = {
  dailyLimit: bigint;
  dailyUsed: bigint;
};

export function resolveTierLimits(tier: string): TierLimits {
  return tier === 'Verified'
    ? DEFAULT_TIER_LIMITS.Verified
    : DEFAULT_TIER_LIMITS.Standard;
}
