import { Injectable, Logger } from '@nestjs/common';

import type { AblinerTransaction, AblinerWebhookInput } from '@mori-pay/contracts';

import { AblinerClient } from '../abliner/abliner.client.js';
import type { Transaction } from '../generated/prisma/client.js';
import { isTerminalStatus } from '../payments/transaction-status.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettlementService } from '../settlement/settlement.service.js';

/**
 * Applies signature-verified Abliner webhook outcomes after matching the
 * provider identity, transaction type, currency, and amount. Settlement is
 * idempotent; the separate `reconcile` path verifies outcomes with Abliner.
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
    if (payload.data.reference) {
      identifiers.push(payload.data.reference);
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

    const providerIds = [transaction.internalReference, transaction.providerRef]
      .filter((value): value is string => Boolean(value));
    if (
      (payload.data.customer_reference &&
        payload.data.customer_reference !== transaction.reference) ||
      (!payload.data.customer_reference &&
        !providerIds.includes(payload.data.id) &&
        !providerIds.includes(payload.data.reference))
    ) {
      this.logger.warn(
        `Webhook identifiers do not match transaction ${transaction.reference}; ignoring`,
      );
      return;
    }

    const isDeposit =
      transaction.type === 'deposit' &&
      (payload.data.type === 'deposit' ||
        (payload.data.type === 'checkout' && transaction.channel === 'card'));
    const isWithdrawal =
      transaction.type === 'withdrawal' && payload.data.type === 'withdrawal';
    if ((!isDeposit && !isWithdrawal) || payload.data.currency !== transaction.currency) {
      this.logger.warn(
        `Webhook type or currency does not match transaction ${transaction.reference}; ignoring`,
      );
      return;
    }

    const expectedAmount =
      transaction.type === 'deposit' ? transaction.total : transaction.amount;
    const webhookAmount =
      Number.isSafeInteger(payload.data.amount) && payload.data.amount >= 0
        ? BigInt(payload.data.amount)
        : payload.data.amount_cents !== undefined &&
            Number.isSafeInteger(payload.data.amount_cents) &&
            payload.data.amount_cents >= 0 &&
            payload.data.amount_cents % 100 === 0
          ? BigInt(payload.data.amount_cents) / 100n
          : null;
    if (webhookAmount === null || webhookAmount !== expectedAmount) {
      this.logger.warn(
        `Webhook amount does not match transaction ${transaction.reference}; ignoring`,
      );
      return;
    }

    const providerStatus = payload.data.status.toLowerCase();
    const cancelled =
      providerStatus === 'cancelled' || providerStatus === 'canceled';
    const completed = providerStatus === 'completed';
    const failed = providerStatus === 'failed' || cancelled;
    const matchingEvent = isDeposit
      ? completed
        ? payload.data.type === 'checkout'
          ? payload.event === 'checkout.paid'
          : payload.event === 'transaction.completed'
        : failed && payload.event === 'transaction.failed'
      : completed
        ? payload.event === 'withdrawal.completed'
        : failed && payload.event === 'withdrawal.failed';
    if (!matchingEvent || (!completed && !failed)) {
      this.logger.warn(
        `Webhook status/event is not final for transaction ${transaction.reference}; leaving it pending`,
      );
      return;
    }

    if (transaction.type === 'deposit') {
      if (completed) {
        await this.settlement.settleDeposit(transaction);
      } else if (cancelled) {
        await this.settlement.cancelDeposit(transaction);
      } else {
        await this.settlement.failDeposit(transaction);
      }
    } else if (completed) {
      await this.settlement.settleWithdrawal(transaction);
    } else if (cancelled) {
      await this.settlement.cancelWithdrawal(transaction);
    } else {
      await this.settlement.failWithdrawal(transaction);
    }

    this.logger.log(
      `Applied verified webhook for ${transaction.reference} -> ${
        completed ? 'completed' : cancelled ? 'cancelled' : 'failed'
      }`,
    );
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
    const providerTypeMatches =
      verified.type === transaction.type ||
      (transaction.type === 'deposit' &&
        transaction.channel === 'card' &&
        verified.type === 'checkout');
    if (
      !providerTypeMatches ||
      verifiedAmount === null ||
      verifiedAmount !== expectedAmount
    ) {
      this.logger.warn(
        `Provider record does not match expected type/amount for ${transaction.reference}; leaving it unsettled`,
      );
      return;
    }

    const providerStatus = verified.status.toLowerCase();
    const completed = providerStatus === 'completed';
    const cancelled =
      providerStatus === 'cancelled' || providerStatus === 'canceled';
    const failed = providerStatus === 'failed' || cancelled;
    if (!completed && !failed) return;

    switch (transaction.type) {
      case 'deposit':
        if (completed) await this.settlement.settleDeposit(transaction);
        else if (cancelled) await this.settlement.cancelDeposit(transaction);
        else await this.settlement.failDeposit(transaction);
        break;
      case 'withdrawal':
        if (completed) await this.settlement.settleWithdrawal(transaction);
        else if (cancelled) await this.settlement.cancelWithdrawal(transaction);
        else await this.settlement.failWithdrawal(transaction);
        break;
      default:
        this.logger.warn(
          `No reconciliation handler for transaction type ${transaction.type}`,
        );
        return;
    }

    this.logger.log(
      `Reconciled ${transaction.reference} (${transaction.type}) -> ${
        completed ? 'completed' : cancelled ? 'cancelled' : 'failed'
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
