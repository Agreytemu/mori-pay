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
 * Resolves the fee for a movement from the `FeeRule` table. When no rule
 * matches, the movement is free. Applied percentages are persisted on each
 * transaction and the complete fee is disclosed before confirmation.
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
