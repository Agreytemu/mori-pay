import { Injectable, Logger } from '@nestjs/common';

import type { AblinerWebhookInput } from '@mori-pay/contracts';

import { AblinerClient } from '../abliner/abliner.client.js';
import type { Transaction } from '../generated/prisma/client.js';
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
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        OR: [
          { internalReference: payload.data.id },
          { providerRef: payload.data.id },
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
   */
  async reconcile(transaction: Transaction): Promise<void> {
    if (transaction.status !== 'pending' && transaction.status !== 'processing') {
      return;
    }
    if (transaction.provider !== 'abliner') return;

    const reference = transaction.internalReference ?? transaction.providerRef;
    if (!reference) return;

    const verified = await this.abliner.getTransaction(reference);
    if (!verified || verified.status === 'pending') return;

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
}
