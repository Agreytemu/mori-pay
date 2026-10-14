import { Injectable, Logger } from '@nestjs/common';

import type { Prisma, Transaction } from '../generated/prisma/client.js';
import {
  LedgerService,
  SYSTEM_LEDGER_ACCOUNTS,
  type LedgerLeg,
} from '../ledger/ledger.service.js';
import {
  TRANSACTION_STATUS,
  canTransition,
} from '../payments/transaction-status.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LEDGER_ACCOUNT_AVAILABLE } from '../wallet/wallet.mapper.js';

type Client = Prisma.TransactionClient;

/**
 * Applies the ledger consequences of money crossing the Mori Pay boundary.
 * Every method is idempotent: a transaction's `status` is claimed with a
 * conditional update before any ledger posting, so duplicate webhooks or
 * retries cannot double-post.
 */
@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /** Places a hold by moving funds from the user's available account. */
  async postWithdrawalHold(
    transaction: Transaction,
    client: Client,
  ): Promise<void> {
    const accountId = await this.availableAccountId(transaction.userId, client);
    const clearing = await this.ledger.getSystemAccount(
      SYSTEM_LEDGER_ACCOUNTS.clearing,
      client,
    );

    const legs: LedgerLeg[] = [
      {
        ledgerAccountId: accountId,
        direction: 'debit',
        amount: transaction.amount + transaction.fee,
      },
      { ledgerAccountId: clearing.id, direction: 'credit', amount: transaction.amount },
    ];

    if (transaction.fee > 0n) {
      const fees = await this.ledger.getSystemAccount(
        SYSTEM_LEDGER_ACCOUNTS.fees,
        client,
      );
      legs.push({ ledgerAccountId: fees.id, direction: 'credit', amount: transaction.fee });
    }

    await this.ledger.post(
      { reference: transaction.reference, transactionId: transaction.id, legs },
      client,
    );
  }

  /** A top-up cleared: move money from the outside world into the wallet. */
  async settleDeposit(transaction: Transaction): Promise<void> {
    if (!canTransition(transaction.type, transaction.status, TRANSACTION_STATUS.completed)) return;

    await this.prisma.$transaction(async (client) => {
      const claimed = await client.transaction.updateMany({
        where: { id: transaction.id, status: TRANSACTION_STATUS.pending },
        data: {
          status: TRANSACTION_STATUS.completed,
          providerStatus: 'completed',
          settledAt: new Date(),
        },
      });
      if (claimed.count === 0) return;

      const external = await this.ledger.getSystemAccount(
        SYSTEM_LEDGER_ACCOUNTS.external,
        client,
      );
      const accountId = await this.availableAccountId(transaction.userId, client);
      const legs: LedgerLeg[] = [
        {
          ledgerAccountId: external.id,
          direction: 'debit',
          amount: transaction.total,
          allowNegative: true,
        },
        { ledgerAccountId: accountId, direction: 'credit', amount: transaction.amount },
      ];

      if (transaction.fee > 0n) {
        const fees = await this.ledger.getSystemAccount(
          SYSTEM_LEDGER_ACCOUNTS.fees,
          client,
        );
        legs.push({
          ledgerAccountId: fees.id,
          direction: 'credit',
          amount: transaction.fee,
        });
      }

      await this.ledger.post(
        {
          reference: `${transaction.reference}-credit`,
          transactionId: transaction.id,
          legs,
        },
        client,
      );
    });
  }

  async failDeposit(transaction: Transaction): Promise<void> {
    await this.finalizeDeposit(transaction, TRANSACTION_STATUS.failed);
  }

  async cancelDeposit(transaction: Transaction): Promise<void> {
    await this.finalizeDeposit(transaction, TRANSACTION_STATUS.cancelled);
  }

  private async finalizeDeposit(
    transaction: Transaction,
    status: 'failed' | 'cancelled',
  ): Promise<void> {
    if (!canTransition(transaction.type, transaction.status, status)) return;

    await this.prisma.transaction.updateMany({
      where: { id: transaction.id, status: TRANSACTION_STATUS.pending },
      data: {
        status,
        providerStatus: status,
      },
    });
  }

  /** A payout cleared: release the hold to the outside world. */
  async settleWithdrawal(transaction: Transaction): Promise<void> {
    if (!canTransition(transaction.type, transaction.status, TRANSACTION_STATUS.completed)) return;

    await this.prisma.$transaction(async (client) => {
      const claimed = await client.transaction.updateMany({
        where: { id: transaction.id, status: TRANSACTION_STATUS.processing },
        data: {
          status: TRANSACTION_STATUS.completed,
          providerStatus: 'completed',
          settledAt: new Date(),
        },
      });
      if (claimed.count === 0) return;

      const clearing = await this.ledger.getSystemAccount(
        SYSTEM_LEDGER_ACCOUNTS.clearing,
        client,
      );
      const external = await this.ledger.getSystemAccount(
        SYSTEM_LEDGER_ACCOUNTS.external,
        client,
      );

      await this.ledger.post(
        {
          reference: `${transaction.reference}-settle`,
          legs: [
            { ledgerAccountId: clearing.id, direction: 'debit', amount: transaction.amount },
            {
              ledgerAccountId: external.id,
              direction: 'credit',
              amount: transaction.amount,
              allowNegative: true,
            },
          ],
        },
        client,
      );
    });
  }

  /** A payout failed: return the held funds (and fee) to the user. */
  async failWithdrawal(transaction: Transaction): Promise<void> {
    await this.finalizeWithdrawal(transaction, TRANSACTION_STATUS.failed);
  }

  async cancelWithdrawal(transaction: Transaction): Promise<void> {
    await this.finalizeWithdrawal(transaction, TRANSACTION_STATUS.cancelled);
  }

  private async finalizeWithdrawal(
    transaction: Transaction,
    status: 'failed' | 'cancelled',
  ): Promise<void> {
    if (!canTransition(transaction.type, transaction.status, status)) return;
    await this.prisma.$transaction(async (client) => {
      const claimed = await client.transaction.updateMany({
        where: { id: transaction.id, status: TRANSACTION_STATUS.processing },
        data: {
          status,
          providerStatus: status,
        },
      });
      if (claimed.count === 0) return;

      const accountId = await this.availableAccountId(transaction.userId, client);
      const clearing = await this.ledger.getSystemAccount(
        SYSTEM_LEDGER_ACCOUNTS.clearing,
        client,
      );

      const legs: LedgerLeg[] = [
        { ledgerAccountId: clearing.id, direction: 'debit', amount: transaction.amount },
        { ledgerAccountId: accountId, direction: 'credit', amount: transaction.amount },
      ];

      if (transaction.fee > 0n) {
        const fees = await this.ledger.getSystemAccount(
          SYSTEM_LEDGER_ACCOUNTS.fees,
          client,
        );
        legs.push({ ledgerAccountId: fees.id, direction: 'debit', amount: transaction.fee });
        legs.push({ ledgerAccountId: accountId, direction: 'credit', amount: transaction.fee });
      }

      await this.ledger.post(
        { reference: `${transaction.reference}-release`, legs },
        client,
      );
    });
  }

  private async availableAccountId(userId: string, client: Client): Promise<string> {
    const wallet = await client.wallet.findUnique({
      where: { userId },
      include: { ledgerAccounts: true },
    });
    const account = wallet?.ledgerAccounts.find(
      (candidate) => candidate.kind === LEDGER_ACCOUNT_AVAILABLE,
    );
    if (!account) {
      this.logger.error(`No available ledger account for user ${userId}`);
      throw new Error('Wallet is not active');
    }
    return account.id;
  }
}
