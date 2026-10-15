import { BadRequestException, Injectable } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { TRANSACTION_STATUS } from '../payments/transaction-status.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LimitsSummary, TierLimits } from './limits.config.js';

/** Rolling window used for the "daily" outflow ceiling. */
const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Debits in these states count against the ceiling; terminal failures don't. */
const OUTFLOW_STATUSES: string[] = [
  TRANSACTION_STATUS.pending,
  TRANSACTION_STATUS.processing,
  TRANSACTION_STATUS.completed,
];

type Client = Prisma.TransactionClient;

/**
 * Enforces per-tier outflow limits on money leaving a wallet. Usage is derived
 * from the transaction table (the source of truth) rather than a mutable
 * counter, so it can never drift from the ledger.
 *
 * Because the check reads rows that other in-flight transactions have not yet
 * committed, a plain read-then-write check can be passed twice under
 * concurrency. `assertWithinLimitsForUpdate` closes that race with a
 * transaction-scoped Postgres advisory lock keyed by the user, so every
 * limit-consuming debit for one user is serialised.
 */
@Injectable()
export class LimitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  limitsFor(tier: string): TierLimits {
    const limits = this.config.limits;
    return tier === 'Verified' ? limits.verified : limits.standard;
  }

  /** Sum of debits over the rolling 24h window. */
  async getOutflowUsage(
    userId: string,
    since: Date = new Date(Date.now() - WINDOW_MS),
  ): Promise<bigint> {
    return this.getOutflowUsageWith(this.prisma, userId, since);
  }

  private async getOutflowUsageWith(
    client: Client | PrismaService,
    userId: string,
    since: Date = new Date(Date.now() - WINDOW_MS),
  ): Promise<bigint> {
    const aggregate = await client.transaction.aggregate({
      where: {
        userId,
        direction: 'debit',
        status: { in: OUTFLOW_STATUSES },
        createdAt: { gte: since },
      },
      _sum: { amount: true, fee: true },
    });
    return (aggregate._sum.amount ?? 0n) + (aggregate._sum.fee ?? 0n);
  }

  /** Limit + usage for display on the wallet balance card. */
  async getSummary(userId: string, tier: string): Promise<LimitsSummary> {
    const limits = this.limitsFor(tier);
    return {
      dailyLimit: limits.dailyOutflow,
      dailyUsed: await this.getOutflowUsage(userId),
    };
  }

  /**
   * `totalDebit` includes fees so the limit reflects the full wallet debit.
   * Callers invoke this after PIN verification and before moving money. This
   * non-transactional variant is only safe for preview/validation paths; money
   * movement must use `assertWithinLimitsForUpdate` inside the DB transaction.
   */
  async assertWithinLimits(
    userId: string,
    tier: string,
    totalDebit: bigint,
  ): Promise<void> {
    this.assertAmountWithinLimits(tier, totalDebit);
    const used = await this.getOutflowUsage(userId);
    if (used + totalDebit > this.limitsFor(tier).dailyOutflow) {
      throw new BadRequestException(
        'This transaction would exceed your daily limit',
      );
    }
  }

  /**
   * Concurrency-safe enforcement: takes a transaction-scoped advisory lock for
   * the user, then re-reads usage inside the caller's transaction so two
   * simultaneous requests cannot both pass on the same stale usage.
   */
  async assertWithinLimitsForUpdate(
    client: Client,
    userId: string,
    tier: string,
    totalDebit: bigint,
  ): Promise<void> {
    this.assertAmountWithinLimits(tier, totalDebit);
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const used = await this.getOutflowUsageWith(client, userId);
    if (used + totalDebit > this.limitsFor(tier).dailyOutflow) {
      throw new BadRequestException(
        'This transaction would exceed your daily limit',
      );
    }
  }

  private assertAmountWithinLimits(tier: string, totalDebit: bigint): void {
    const limits = this.limitsFor(tier);
    if (totalDebit > limits.perTransaction) {
      throw new BadRequestException(
        `Amount exceeds your per-transaction limit of ${limits.perTransaction} TZS`,
      );
    }
  }
}
