import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

export type FeeQuery = {
  type: string;
  channel: string;
  amount: bigint;
};

/**
 * Resolves the fee for a movement from the `FeeRule` table. When no rule
 * matches (the default for internal P2P), the movement is free.
 */
@Injectable()
export class FeesService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveFee(query: FeeQuery): Promise<bigint> {
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

    if (!rule) return 0n;

    const percentageFee = BigInt(Math.floor(Number(amount) * rule.percentage));
    return rule.flat + percentageFee;
  }
}
