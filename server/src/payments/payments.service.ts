import { BadRequestException, Injectable } from '@nestjs/common';

import type { Transaction as TransactionDto } from '@mori-pay/contracts';

import { generateReference } from '../common/crypto.js';
import {
  LedgerService,
  SYSTEM_LEDGER_ACCOUNTS,
  type LedgerLeg,
  type SystemLedgerAccountKind,
} from '../ledger/ledger.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { createTransactionNotification } from '../account/notification-writer.js';
import type { FeeDetail } from './fees.service.js';
import {
  LEDGER_ACCOUNT_AVAILABLE,
  toTransaction,
  type UserWithWallet,
} from '../wallet/wallet.mapper.js';

export type TransferToUserInput = {
  from: UserWithWallet;
  to: UserWithWallet;
  amount: bigint;
  fee: bigint;
  feeDetail?: FeeDetail;
  note?: string;
  type: string;
  category: string;
  idempotencyKey?: string;
};

export type PaySystemInput = {
  from: UserWithWallet;
  system: SystemLedgerAccountKind;
  amount: bigint;
  fee: bigint;
  feeDetail?: FeeDetail;
  note?: string;
  type: string;
  category: string;
  counterparty: string;
  counterpartyDetail?: string;
  idempotencyKey?: string;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Core executor for internal money movement. It records the user-visible
 * transaction(s) and the balanced ledger postings in one database
 * transaction, so a business record never exists without its ledger entries.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /** Debits the sender and credits the recipient, recording both histories. */
  async transferToUser(input: TransferToUserInput): Promise<TransactionDto> {
    const fromAccountId = this.availableAccount(input.from);
    const toAccountId = this.availableAccount(input.to);
    if (fromAccountId === toAccountId) {
      throw new BadRequestException('Cannot transfer to the same wallet');
    }

    const total = input.amount + input.fee;
    const reference = generateReference('TRF');

    return this.prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.transaction.findUnique({
          where: {
            userId_idempotencyKey: {
              userId: input.from.id,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (existing) return toTransaction(existing);
      }

      const senderTransaction = await tx.transaction.create({
        data: {
          userId: input.from.id,
          reference,
          type: input.type,
          status: 'completed',
          category: input.category,
          channel: 'wallet',
          direction: 'debit',
          amount: input.amount,
          fee: input.fee,
          feeFlat: input.feeDetail?.flat ?? 0n,
          feePercentage: input.feeDetail?.percentage ?? 0,
          total,
          counterparty: input.to.fullName,
          counterpartyDetail: input.to.phone,
          note: input.note ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          settledAt: new Date(),
          metadata: { recipientUserId: input.to.id },
        },
      });
      await createTransactionNotification(tx, senderTransaction);

      const receiverTransaction = await tx.transaction.create({
        data: {
          userId: input.to.id,
          reference: generateReference('RCV'),
          type: 'receive',
          status: 'completed',
          category: input.category,
          channel: 'wallet',
          direction: 'credit',
          amount: input.amount,
          fee: 0n,
          total: input.amount,
          counterparty: input.from.fullName,
          counterpartyDetail: input.from.phone,
          note: input.note ?? null,
          settledAt: new Date(),
          metadata: {
            senderUserId: input.from.id,
            counterpartTransactionId: senderTransaction.id,
          },
        },
      });
      await createTransactionNotification(tx, receiverTransaction);

      const legs: LedgerLeg[] = [
        { ledgerAccountId: fromAccountId, direction: 'debit', amount: total },
        { ledgerAccountId: toAccountId, direction: 'credit', amount: input.amount },
      ];

      if (input.fee > 0n) {
        const feesAccount = await this.ledger.getSystemAccount(
          SYSTEM_LEDGER_ACCOUNTS.fees,
          tx,
        );
        legs.push({
          ledgerAccountId: feesAccount.id,
          direction: 'credit',
          amount: input.fee,
        });
      }

      await this.ledger.post(
        { reference, transactionId: senderTransaction.id, legs },
        tx,
      );

      return toTransaction(senderTransaction);
    });
  }

  /** Debits the payer and credits a wallet-less system account (e.g. merchant). */
  async paySystem(input: PaySystemInput): Promise<TransactionDto> {
    const fromAccountId = this.availableAccount(input.from);
    const total = input.amount + input.fee;
    const reference = generateReference('PAY');

    return this.prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.transaction.findUnique({
          where: {
            userId_idempotencyKey: {
              userId: input.from.id,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (existing) return toTransaction(existing);
      }

      const payerTransaction = await tx.transaction.create({
        data: {
          userId: input.from.id,
          reference,
          type: input.type,
          status: 'completed',
          category: input.category,
          channel: 'wallet',
          direction: 'debit',
          amount: input.amount,
          fee: input.fee,
          feeFlat: input.feeDetail?.flat ?? 0n,
          feePercentage: input.feeDetail?.percentage ?? 0,
          total,
          counterparty: input.counterparty,
          counterpartyDetail: input.counterpartyDetail ?? null,
          note: input.note ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          settledAt: new Date(),
          metadata: input.metadata ?? undefined,
        },
      });
      await createTransactionNotification(tx, payerTransaction);

      const systemAccount = await this.ledger.getSystemAccount(input.system, tx);
      const legs: LedgerLeg[] = [
        { ledgerAccountId: fromAccountId, direction: 'debit', amount: total },
        { ledgerAccountId: systemAccount.id, direction: 'credit', amount: input.amount },
      ];

      if (input.fee > 0n) {
        const feesAccount = await this.ledger.getSystemAccount(
          SYSTEM_LEDGER_ACCOUNTS.fees,
          tx,
        );
        legs.push({
          ledgerAccountId: feesAccount.id,
          direction: 'credit',
          amount: input.fee,
        });
      }

      await this.ledger.post(
        { reference, transactionId: payerTransaction.id, legs },
        tx,
      );

      return toTransaction(payerTransaction);
    });
  }

  private availableAccount(user: UserWithWallet): string {
    const account = user.wallet?.ledgerAccounts.find(
      (candidate) => candidate.kind === LEDGER_ACCOUNT_AVAILABLE,
    );
    if (!account) throw new BadRequestException('Wallet is not active');
    return account.id;
  }
}
