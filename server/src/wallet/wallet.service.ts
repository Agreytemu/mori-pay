import { Injectable, NotFoundException } from '@nestjs/common';

import type {
  Paginated,
  Transaction as TransactionDto,
  WalletAccount,
} from '@mori-pay/contracts';

import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toTransaction, toWalletAccount, type UserWithWallet } from './wallet.mapper.js';

export type TransactionListOptions = {
  query?: string;
  types?: string[];
  status?: string;
  cursor?: string | null;
  limit: number;
};

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(userId: string): Promise<WalletAccount> {
    const user = await this.loadUserWithWallet(userId);
    return toWalletAccount(user);
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
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    return toTransaction(transaction);
  }
}
