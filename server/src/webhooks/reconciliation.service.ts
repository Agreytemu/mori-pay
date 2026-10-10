import { Injectable, Logger } from '@nestjs/common';

import type { StakabaWebhookInput } from '@mori-pay/contracts';

import { PrismaService } from '../prisma/prisma.service.js';
import { SettlementService } from '../settlement/settlement.service.js';
import { StakabaClient } from '../stakaba/stakaba.client.js';

/**
 * Turns a Stakaba webhook into a settled (or failed) transaction. The payload
 * is never trusted on its own: the transaction is re-fetched from Stakaba
 * before any money moves, then `SettlementService` applies the change
 * idempotently.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stakaba: StakabaClient,
    private readonly settlement: SettlementService,
  ) {}

  async process(payload: StakabaWebhookInput): Promise<void> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { internalReference: payload.internalReference },
    });

    if (!transaction) {
      this.logger.warn(
        `Webhook for unknown reference ${payload.internalReference} (${payload.event})`,
      );
      return;
    }

    if (transaction.status === 'completed' || transaction.status === 'failed') {
      return;
    }

    const verified = await this.stakaba.getTransaction(payload.internalReference);
    const success = verified.status === 'SUCCESS';

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
    }

    this.logger.log(
      `Reconciled ${transaction.reference} (${transaction.type}) -> ${
        success ? 'completed' : 'failed'
      }`,
    );
  }
}
