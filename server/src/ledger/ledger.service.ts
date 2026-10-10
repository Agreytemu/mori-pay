import { Injectable } from '@nestjs/common';

import { InsufficientFundsError, InvalidLedgerLegError, UnbalancedLedgerError } from '../common/errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type LedgerDirection = 'credit' | 'debit';

export type LedgerLeg = {
  ledgerAccountId: string;
  direction: LedgerDirection;
  amount: bigint;
  /** When true an `available` account may be debited below zero. */
  allowNegative?: boolean;
};

export type PostEntriesInput = {
  /** Human-readable reason recorded for idempotency/debugging. */
  reference: string;
  /** Links every leg to a transaction, enabling idempotent re-posting. */
  transactionId?: string;
  legs: LedgerLeg[];
};

/** Kinds reserved for system (wallet-less) ledger accounts. */
export const SYSTEM_LEDGER_ACCOUNTS = {
  /** Money entering/leaving the Mori Pay system (the outside world). */
  external: 'external',
  /** Fees retained by Mori Pay. */
  fees: 'fees',
  /** Abliner settlement in-flight. */
  clearing: 'clearing',
  /** Funds collected from merchant payments, awaiting settlement. */
  merchant: 'merchant_settlement',
} as const;

export type SystemLedgerAccountKind =
  (typeof SYSTEM_LEDGER_ACCOUNTS)[keyof typeof SYSTEM_LEDGER_ACCOUNTS];

type Client = Prisma.TransactionClient;

/**
 * Minimal double-entry ledger engine. Every money movement is expressed as a
 * balanced set of legs (sum of credits === sum of debits) applied atomically;
 * callers are expected to run `post` inside `prisma.$transaction` so the
 * business record and its ledger entries commit together.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns (creating if necessary) a wallet-less system account. */
  async getSystemAccount(
    kind: SystemLedgerAccountKind,
    client: Client = this.prisma,
  ): Promise<{ id: string }> {
    const existing = await client.ledgerAccount.findFirst({
      where: { walletId: null, kind },
      select: { id: true },
    });
    if (existing) return existing;

    try {
      return await client.ledgerAccount.create({
        data: { kind, currency: 'TZS', balance: 0n },
        select: { id: true },
      });
    } catch {
      return client.ledgerAccount.findFirstOrThrow({
        where: { walletId: null, kind },
        select: { id: true },
      });
    }
  }

  /**
   * Applies a balanced set of entries, updating each account balance and
   * recording a per-entry `balanceAfter` snapshot. When `transactionId` is set
   * and entries already exist, the call becomes a no-op (idempotent).
   */
  async post(input: PostEntriesInput, client: Client = this.prisma): Promise<void> {
    const { legs, transactionId } = input;

    if (legs.length < 2) {
      throw new InvalidLedgerLegError('A posting requires at least two legs');
    }

    let debits = 0n;
    let credits = 0n;
    for (const leg of legs) {
      if (leg.amount <= 0n) {
        throw new InvalidLedgerLegError('Leg amounts must be positive');
      }
      if (leg.direction === 'debit') debits += leg.amount;
      else credits += leg.amount;
    }
    if (debits !== credits) {
      throw new UnbalancedLedgerError(
        `Posting is unbalanced: debits=${debits} credits=${credits}`,
      );
    }

    if (transactionId) {
      const existing = await client.ledgerEntry.count({
        where: { transactionId },
      });
      if (existing > 0) return;
    }

    for (const leg of legs) {
      const delta = leg.direction === 'credit' ? leg.amount : -leg.amount;
      const updated = await client.ledgerAccount.update({
        where: { id: leg.ledgerAccountId },
        data: { balance: { increment: delta } },
        select: { balance: true, kind: true },
      });

      if (!leg.allowNegative && updated.balance < 0n) {
        throw new InsufficientFundsError();
      }

      await client.ledgerEntry.create({
        data: {
          ledgerAccountId: leg.ledgerAccountId,
          transactionId: transactionId ?? null,
          direction: leg.direction,
          amount: leg.amount,
          balanceAfter: updated.balance,
        },
      });
    }
  }
}
