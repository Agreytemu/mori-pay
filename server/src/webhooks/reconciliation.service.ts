import { Injectable, Logger } from '@nestjs/common';

import type { AblinerTransaction, AblinerWebhookInput } from '@mori-pay/contracts';

import { AblinerClient } from '../abliner/abliner.client.js';
import type { Transaction } from '../generated/prisma/client.js';
import { isTerminalStatus } from '../payments/transaction-status.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettlementService } from '../settlement/settlement.service.js';

/**
 * Turns an Abliner webhook into a settled (or failed) transaction. The payload
 * is never trusted on its own: the transaction is re-fetched from Abliner
 * before any money moves, then `SettlementService` applies the change
 * idempotently.
 *
 * Exposed as `reconcile` so the wallet read path can lazily settle a pending
 * gateway transaction in environments where the webhook cannot reach us.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly abliner: AblinerClient,
    private readonly settlement: SettlementService,
  ) {}

  async process(payload: AblinerWebhookInput): Promise<void> {
    const identifiers = [payload.data.id];
    if (payload.data.customer_reference) {
      identifiers.push(payload.data.customer_reference);
    }

    // Match on either Abliner's transaction id or the reference we generated,
    // so a webhook still settles a transaction whose create-response was lost.
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        provider: 'abliner',
        OR: [
          { internalReference: { in: identifiers } },
          { providerRef: { in: identifiers } },
          ...(payload.data.customer_reference
            ? [{ reference: payload.data.customer_reference }]
            : []),
        ],
      },
    });

    if (!transaction) {
      this.logger.warn(
        `Webhook for unknown reference ${payload.data.id} (${payload.event})`,
      );
      return;
    }

    await this.reconcile(transaction);
  }

  /**
   * Re-verifies a pending gateway transaction with Abliner and settles it.
   * A no-op for internal movements or already-final transactions.
   *
   * A missing/empty provider lookup is never treated as failure: the
   * transaction stays pending until Abliner reports a final status.
   */
  async reconcile(transaction: Transaction): Promise<void> {
    if (isTerminalStatus(transaction.status)) return;
    if (transaction.provider !== 'abliner') return;

    const verified = await this.verify(transaction);
    if (!verified || verified.status === 'pending') return;

    const expectedAmount =
      transaction.type === 'deposit' ? transaction.total : transaction.amount;
    const verifiedAmount =
      verified.amount !== undefined
        ? Number.isSafeInteger(verified.amount)
          ? BigInt(verified.amount)
          : null
        : verified.amount_cents !== undefined &&
            Number.isSafeInteger(verified.amount_cents) &&
            verified.amount_cents % 100 === 0
          ? BigInt(verified.amount_cents) / 100n
          : null;
    if (
      verified.type !== transaction.type ||
      verifiedAmount === null ||
      verifiedAmount !== expectedAmount
    ) {
      this.logger.warn(
        `Provider record does not match expected type/amount for ${transaction.reference}; leaving it unsettled`,
      );
      return;
    }

    const success = verified.status === 'completed';

    switch (transaction.type) {
      case 'deposit':
        await (success
          ? this.settlement.settleDeposit(transaction)
          : this.settlement.failDeposit(transaction));
        break;
      case 'withdrawal':
        await (success
          ? this.settlement.settleWithdrawal(transaction)
          : this.settlement.failWithdrawal(transaction));
        break;
      default:
        this.logger.warn(
          `No reconciliation handler for transaction type ${transaction.type}`,
        );
        return;
    }

    this.logger.log(
      `Reconciled ${transaction.reference} (${transaction.type}) -> ${
        success ? 'completed' : 'failed'
      }`,
    );
  }

  /**
   * Looks the transaction up at Abliner, trying every identifier we hold:
   * the provider id, our reference (echoed as `customer_reference`), and — for
   * deposits — the `Idempotency-Key` we sent (the transaction id).
   */
  private async verify(
    transaction: Transaction,
  ): Promise<AblinerTransaction | null> {
    const providerId =
      transaction.internalReference ?? transaction.providerRef ?? undefined;

    const attempts: Array<{
      id?: string;
      customerReference?: string;
      idempotencyKey?: string;
    }> = [];
    if (providerId) attempts.push({ id: providerId });
    attempts.push({ customerReference: transaction.reference });
    if (transaction.type === 'deposit') {
      attempts.push({ idempotencyKey: transaction.id });
    }

    for (const query of attempts) {
      try {
        const found = await this.abliner.findTransaction(query);
        if (found) return found;
      } catch (error) {
        this.logger.warn(
          `Reconcile lookup failed for ${transaction.reference}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return null;
  }
}
