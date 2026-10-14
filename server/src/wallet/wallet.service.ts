import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import type {
  Paginated,
  ReceiveCode,
  Transaction as TransactionDto,
  WalletAccount,
} from '@mori-pay/contracts';

import type { Prisma } from '../generated/prisma/client.js';
import { LimitsService } from '../limits/limits.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReceiveCodeService } from '../qr/receive-code.service.js';
import { ReconciliationService } from '../webhooks/reconciliation.service.js';
import { toTransaction, toWalletAccount, type UserWithWallet } from './wallet.mapper.js';

export type TransactionListOptions = {
  query?: string;
  types?: string[];
  status?: string;
  cursor?: string | null;
  limit: number;
};

const PROVIDER_CHECK_MIN_AGE_MS = 30_000;
const PROVIDER_CHECK_INTERVAL_MS = 5_000;

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly providerCheckAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: ReconciliationService,
    private readonly limits: LimitsService,
    private readonly receiveCodes: ReceiveCodeService,
  ) {}

  async getWallet(userId: string): Promise<WalletAccount> {
    const user = await this.loadUserWithWallet(userId);
    const summary = await this.limits.getSummary(user.id, user.tier);
    return toWalletAccount(user, summary);
  }

  /** Issues a fresh signed receive code for the user's receive QR. */
  getReceiveCode(userId: string): ReceiveCode {
    return this.receiveCodes.issue(userId);
  }

  /** Loads a user together with their wallet and ledger accounts. */
  async loadUserWithWallet(userId: string): Promise<UserWithWallet> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: { include: { ledgerAccounts: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async listTransactions(
    userId: string,
    options: TransactionListOptions,
  ): Promise<Paginated<TransactionDto>> {
    const { query, types, status, cursor, limit } = options;

    const where: Prisma.TransactionWhereInput = { userId };
    if (status && status !== 'all') where.status = status;
    if (types && types.length > 0) where.type = { in: types };
    if (query) {
      where.OR = [
        { counterparty: { contains: query, mode: 'insensitive' } },
        { counterpartyDetail: { contains: query, mode: 'insensitive' } },
        { reference: { contains: query, mode: 'insensitive' } },
        { note: { contains: query, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(toTransaction);

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async getTransaction(userId: string, id: string): Promise<TransactionDto> {
    let transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!transaction) throw new NotFoundException('Transaction not found');

    const isInFlight =
      transaction.status === 'pending' || transaction.status === 'processing';
    const isProviderTransaction = transaction.provider === 'abliner';
    const oldEnough =
      Date.now() - transaction.createdAt.getTime() >= PROVIDER_CHECK_MIN_AGE_MS;
    const lastCheckedAt = this.providerCheckAt.get(transaction.id) ?? 0;
    const checkIsDue =
      Date.now() - lastCheckedAt >= PROVIDER_CHECK_INTERVAL_MS;

    if (isInFlight && isProviderTransaction && oldEnough && checkIsDue) {
      this.providerCheckAt.set(transaction.id, Date.now());
      if (this.providerCheckAt.size > 5_000) {
        const oldestId = this.providerCheckAt.keys().next().value;
        if (oldestId) this.providerCheckAt.delete(oldestId);
      }
      try {
        await this.reconciliation.reconcile(transaction);
        const refreshed = await this.prisma.transaction.findUnique({
          where: { id: transaction.id },
        });
        if (refreshed) transaction = refreshed;
        if (
          transaction.status !== 'pending' &&
          transaction.status !== 'processing'
        ) {
          this.providerCheckAt.delete(transaction.id);
        }
      } catch (error) {
        this.logger.warn(
          `Reconciliation on read failed for ${transaction.reference}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return toTransaction(transaction);
  }
}
