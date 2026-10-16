import { Injectable, Logger } from '@nestjs/common';

import type { AblinerTransaction, AblinerWebhookInput } from '@mori-pay/contracts';

import { AblinerClient, AblinerProviderError } from '../abliner/abliner.client.js';
import { AppConfigService } from '../config/app-config.service.js';
import type { Transaction } from '../generated/prisma/client.js';
import { isTerminalStatus } from '../payments/transaction-status.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettlementService } from '../settlement/settlement.service.js';

/** Never retry a provider submission closer together than this. */
const MIN_SUBMISSION_COOLDOWN_MS = 60_000;

type VerifyOutcome =
  | { state: 'found'; transaction: AblinerTransaction }
  | { state: 'absent' }
  | { state: 'unknown' };

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
    private readonly config: AppConfigService,
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
   * A failed provider lookup is never treated as failure: the transaction
   * stays pending until Abliner reports a final status. Only an authoritative
   * "no such record" answer may trigger withdrawal resubmission.
   */
  async reconcile(transaction: Transaction): Promise<void> {
    if (isTerminalStatus(transaction.status)) return;
    if (transaction.provider !== 'abliner') return;

    const outcome = await this.verify(transaction);
    if (outcome.state === 'unknown') return;
    if (outcome.state === 'absent') {
      await this.recoverUnsubmittedWithdrawal(transaction);
      return;
    }
    const verified = outcome.transaction;
    if (verified.status === 'pending') return;

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
   *
   * Distinguishes "Abliner answered and has no such record" (authoritative
   * absence, safe to act on) from "the lookup failed" (unknown, never act).
   */
  private async verify(transaction: Transaction): Promise<VerifyOutcome> {
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

    let lookupFailed = false;
    for (const query of attempts) {
      try {
        const found = await this.abliner.findTransaction(query);
        if (found) return { state: 'found', transaction: found };
      } catch (error) {
        lookupFailed = true;
        this.logger.warn(
          `Reconcile lookup failed for ${transaction.reference}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return lookupFailed ? { state: 'unknown' } : { state: 'absent' };
  }

  /**
   * Re-submits a withdrawal that was held but never accepted by the provider
   * (the process died before or during the create call). Eligibility is
   * claimed atomically, so concurrent instances and rapid sweeps cannot send
   * the same payout twice; the same `Idempotency-Key` and reference are reused
   * so a provider that honoured the first attempt replays it instead of paying
   * again. A definitive provider rejection releases the hold exactly once via
   * the settlement status claim; an uncertain outcome keeps the hold.
   */
  private async recoverUnsubmittedWithdrawal(
    transaction: Transaction,
  ): Promise<void> {
    if (transaction.type !== 'withdrawal') return;
    if (transaction.status !== 'processing') return;
    if (transaction.internalReference || transaction.providerRef) return;
    if (transaction.channel !== 'mobileMoney' || transaction.currency !== 'TZS') {
      this.logger.warn(
        `Cannot resubmit withdrawal ${transaction.reference}: unsupported channel or currency`,
      );
      return;
    }

    const staleMs = Math.max(
      this.config.reconciliation.staleSeconds * 1000,
      MIN_SUBMISSION_COOLDOWN_MS,
    );
    const cutoff = new Date(Date.now() - staleMs);
    const claimed = await this.prisma.transaction.updateMany({
      where: {
        id: transaction.id,
        status: 'processing',
        providerRef: null,
        internalReference: null,
        OR: [
          { providerSubmissionAt: null },
          { providerSubmissionAt: { lt: cutoff } },
        ],
      },
      data: { providerSubmissionAt: new Date() },
    });
    if (claimed.count !== 1) return;

    let payout;
    try {
      payout = await this.abliner.createWithdrawal({
        amount: Number(transaction.amount),
        method: 'mobile',
        currency: 'TZS',
        recipient: transaction.counterparty,
        reference: transaction.reference,
        idempotencyKey: transaction.id,
      });
    } catch (error) {
      if (error instanceof AblinerProviderError && !error.retryable) {
        this.logger.warn(
          `Provider rejected resubmission of withdrawal ${transaction.reference}; releasing its hold`,
        );
        await this.settlement.failWithdrawal(transaction);
        return;
      }
      this.logger.warn(
        `Resubmission of withdrawal ${transaction.reference} did not complete: ${
          error instanceof Error ? error.message : String(error)
        }; keeping its hold for another attempt`,
      );
      return;
    }

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        providerRef: payout.id,
        providerStatus: payout.status,
        internalReference: payout.id,
      },
    });
    this.logger.log(
      `Resubmitted withdrawal ${transaction.reference} -> ${payout.id}`,
    );
  }
}
