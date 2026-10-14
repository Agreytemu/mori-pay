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
const RATE_SCALE = 1_000_000n;
const RATE_SCALE_NUMBER = Number(RATE_SCALE);
const FREE_INTERNAL_MOVEMENTS = new Set(['send:wallet', 'payment:wallet']);

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
    if (FREE_INTERNAL_MOVEMENTS.has(`${type}:${channel}`)) return NO_FEE;

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

    if (
      amount < 0n ||
      rule.flat < 0n ||
      !Number.isFinite(rule.percentage) ||
      rule.percentage < 0 ||
      !Number.isSafeInteger(Math.round(rule.percentage * RATE_SCALE_NUMBER))
    ) {
      throw new Error(`Invalid fee rule configuration for ${type}/${channel}`);
    }

    const scaledRate = BigInt(Math.round(rule.percentage * RATE_SCALE_NUMBER));
    const percentageFee =
      (amount * scaledRate + RATE_SCALE / 2n) / RATE_SCALE;
    return {
      fee: rule.flat + percentageFee,
      flat: rule.flat,
      percentage: rule.percentage,
      ruleId: rule.id,
    };
  }
}
