import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

export type FeeQuery = {
  type: string;
  channel: string;
  amount: bigint;
};

/** The applied fee plus the rule inputs that produced it. */
export type FeeDetail = {
  fee: bigint;
  flat: bigint;
  percentage: number;
  ruleId: string | null;
};

const NO_FEE: FeeDetail = { fee: 0n, flat: 0n, percentage: 0, ruleId: null };

/**
 * Proposed user-facing fee tiers, pending product sign-off (currently NO rows
 * are seeded, so every movement is free):
 *   - send / payment (wallet):  0 flat, 0%
 *   - withdrawal (mobile money): 0 flat, 2%   (Abliner cash-out is 2–4%)
 *   - withdrawal (bank):        0 flat, 4%   (Abliner card is 4%)
 * Seed matching `FeeRule` rows (type/channel/minAmount/maxAmount/flat/
 * percentage/active) once the pricing above is approved; the engine picks the
 * most specific rule automatically and `Transaction.feeFlat`/`feePercentage`
 * persist what was applied.
 */

/**
 * Resolves the fee for a movement from the `FeeRule` table. When no rule
 * matches (the default for internal P2P), the movement is free.
 */
@Injectable()
export class FeesService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveFee(query: FeeQuery): Promise<bigint> {
    return (await this.resolveFeeDetail(query)).fee;
  }

  async resolveFeeDetail(query: FeeQuery): Promise<FeeDetail> {
    const { type, channel, amount } = query;

    const rule = await this.prisma.feeRule.findFirst({
      where: {
        type,
        channel,
        active: true,
        minAmount: { lte: amount },
        OR: [{ maxAmount: null }, { maxAmount: { gte: amount } }],
      },
      orderBy: { minAmount: 'desc' },
    });

    if (!rule) return NO_FEE;

    const percentageFee = BigInt(Math.floor(Number(amount) * rule.percentage));
    return {
      fee: rule.flat + percentageFee,
      flat: rule.flat,
      percentage: rule.percentage,
      ruleId: rule.id,
    };
  }
}
