import { Injectable, Logger, Optional } from '@nestjs/common';

import type { AblinerTransaction, AblinerWebhookInput } from '@mori-pay/contracts';

import { AblinerClient, AblinerProviderError } from '../abliner/abliner.client.js';
import {
  ClickPesaClient,
  ClickPesaProviderError,
} from '../clickpesa/clickpesa.client.js';
import type { ClickPesaWebhookInput } from '../clickpesa/clickpesa.types.js';
import { decryptField } from '../common/field-encryption.js';
import { AppConfigService } from '../config/app-config.service.js';
import type { Transaction } from '../generated/prisma/client.js';
import { isTerminalStatus } from '../payments/transaction-status.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettlementService } from '../settlement/settlement.service.js';

/** Never retry a provider submission closer together than this. */
const MIN_SUBMISSION_COOLDOWN_MS = 60_000;
const BANK_DATA_ENCRYPTION_OPTIONS = {
  envName: 'PAYMENT_METHOD_ENCRYPTION_KEY',
  invalidMessage: 'Stored bank payout data is invalid.',
} as const;

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
    @Optional() private readonly clickpesa?: ClickPesaClient,
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

  async processClickPesa(payload: ClickPesaWebhookInput): Promise<void> {
    const orderReference =
      typeof payload.data.orderReference === 'string'
        ? payload.data.orderReference
        : undefined;
    if (!orderReference) {
      this.logger.warn('ClickPesa webhook is missing its order reference');
      return;
    }
    const candidateReferences = [orderReference];
    if (/^WDR[A-Z0-9]+$/i.test(orderReference)) {
      candidateReferences.push(
        `${orderReference.slice(0, 3)}-${orderReference.slice(3)}`,
      );
    }

    const transaction = await this.prisma.transaction.findFirst({
      where: {
        provider: 'clickpesa',
        OR: [
          { reference: { in: candidateReferences } },
          { internalReference: { in: candidateReferences } },
        ],
      },
    });
    if (!transaction) {
      this.logger.warn(`ClickPesa webhook for unknown order ${orderReference}`);
      return;
    }
    if (
      (transaction.type !== 'deposit' && transaction.type !== 'withdrawal') ||
      transaction.currency !== 'TZS'
    ) {
      this.logger.warn(
        `ClickPesa webhook type or currency does not match ${transaction.reference}`,
      );
      return;
    }

    if (transaction.type === 'withdrawal') {
      await this.processClickPesaPayoutWebhook(transaction, payload);
      return;
    }

    const status =
      typeof payload.data.status === 'string'
        ? payload.data.status.toUpperCase()
        : '';
    if (payload.event === 'PAYMENT RECEIVED') {
      const currency =
        payload.data.collectedCurrency ?? payload.data.depositCurrency;
      const amount = this.wholeAmount(
        payload.data.collectedAmount ?? payload.data.depositAmount,
      );
      if (
        (status !== 'SUCCESS' && status !== 'SETTLED') ||
        currency !== transaction.currency ||
        amount === null ||
        amount !== transaction.total
      ) {
        this.logger.warn(
          `ClickPesa webhook amount, currency, or status does not match ${transaction.reference}`,
        );
        return;
      }
      await this.settlement.settleDeposit(transaction);
      return;
    }

    if (payload.event === 'PAYMENT FAILED' && status === 'FAILED') {
      const currency =
        payload.data.collectedCurrency ?? payload.data.depositCurrency;
      const amountValue =
        payload.data.collectedAmount ?? payload.data.depositAmount;
      const amount = this.wholeAmount(
        amountValue,
      );
      if (
        (currency !== undefined && currency !== transaction.currency) ||
        (amountValue !== undefined &&
          (amount === null || amount !== transaction.total))
      ) {
        this.logger.warn(
          `ClickPesa failed-payment details do not match ${transaction.reference}`,
        );
        return;
      }
      await this.settlement.failDeposit(transaction);
      return;
    }

    this.logger.warn(
      `Ignoring ClickPesa event ${payload.event} for ${transaction.reference}`,
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
    if (transaction.provider === 'clickpesa') {
      await this.reconcileClickPesa(transaction);
      return;
    }
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

  private async reconcileClickPesa(transaction: Transaction): Promise<void> {
    if (!this.clickpesa) {
      throw new Error('ClickPesa client is not registered');
    }
    const orderReference =
      transaction.internalReference ??
      (transaction.type === 'withdrawal'
        ? transaction.reference.replace(/[^a-z0-9]/gi, '').slice(0, 20)
        : transaction.reference);
    if (transaction.type === 'deposit') {
      const payment = await this.clickpesa.getPayment(orderReference);
      if (!payment || payment.orderReference !== orderReference) return;
      if (
        (payment.status === 'SUCCESS' || payment.status === 'SETTLED') &&
        (payment.collectedCurrency !== transaction.currency ||
          this.wholeAmount(payment.collectedAmount) !== transaction.total)
      ) {
        this.logger.warn(
          `ClickPesa payment details do not match ${transaction.reference}; leaving it unsettled`,
        );
        return;
      }
      if (payment.status === 'SUCCESS' || payment.status === 'SETTLED') {
        await this.settlement.settleDeposit(transaction);
      } else if (payment.status === 'FAILED') {
        await this.settlement.failDeposit(transaction);
      }
      return;
    }

    const payout = await this.clickpesa.getPayout(orderReference);
    if (!payout || payout.orderReference !== orderReference) {
      await this.recoverClickPesaPayout(transaction, orderReference);
      return;
    }
    if (!this.matchesClickPesaPayout(transaction, payout)) {
      this.logger.warn(
        `ClickPesa payout details do not match ${transaction.reference}; leaving it unsettled`,
      );
      return;
    }
    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { providerStatus: payout.status, providerRef: payout.id },
    });
    if (payout.status === 'SUCCESS') {
      await this.settlement.settleWithdrawal(transaction);
    } else if (
      payout.status === 'FAILED' ||
      payout.status === 'REFUNDED' ||
      payout.status === 'REVERSED'
    ) {
      await this.settlement.failWithdrawal(transaction);
    }
  }

  private async processClickPesaPayoutWebhook(
    transaction: Transaction,
    payload: ClickPesaWebhookInput,
  ): Promise<void> {
    const data = payload.data;
    const status =
      typeof data.status === 'string' ? data.status.toUpperCase() : '';
    const order = this.isRecord(data.order) ? data.order : {};
    const amount = this.wholeAmount(order.amount ?? data.amount);
    const currency = order.currency ?? data.currency;
    const channel = typeof data.channel === 'string' ? data.channel.toUpperCase() : '';
    const channelMatches =
      transaction.channel === 'bank'
        ? channel.includes('BANK')
        : channel.includes('MOBILE MONEY');
    if (
      amount !== transaction.amount ||
      currency !== transaction.currency ||
      !channelMatches
    ) {
      this.logger.warn(
        `ClickPesa payout amount, currency, or channel does not match ${transaction.reference}`,
      );
      return;
    }

    const successful =
      payload.event === 'PAYOUT INITIATED' && status === 'SUCCESS';
    const failed =
      (payload.event === 'PAYOUT INITIATED' && status === 'FAILED') ||
      (payload.event === 'PAYOUT REFUNDED' && status === 'REFUNDED') ||
      (payload.event === 'PAYOUT REVERSED' && status === 'REVERSED');
    if (!successful && !failed) {
      if (
        ['AUTHORIZED', 'PROCESSING', 'PENDING'].includes(status) ||
        payload.event === 'PAYOUT INITIATED'
      ) {
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: { providerStatus: status || payload.event },
        });
      } else {
        this.logger.warn(
          `Ignoring ClickPesa payout event ${payload.event} for ${transaction.reference}`,
        );
      }
      return;
    }

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { providerStatus: status },
    });
    if (successful) {
      await this.settlement.settleWithdrawal(transaction);
    } else {
      await this.settlement.failWithdrawal(transaction);
    }
  }

  private matchesClickPesaPayout(
    transaction: Transaction,
    payout: NonNullable<Awaited<ReturnType<ClickPesaClient['getPayout']>>>,
  ): boolean {
    if (
      payout.currency !== transaction.currency ||
      this.wholeAmount(payout.amount) !== transaction.amount
    ) {
      return false;
    }
    const channel = payout.channel?.toUpperCase() ?? '';
    return transaction.channel === 'bank'
      ? channel.includes('BANK')
      : channel.includes('MOBILE MONEY');
  }

  private async recoverClickPesaPayout(
    transaction: Transaction,
    orderReference: string,
  ): Promise<void> {
    if (transaction.status !== 'processing' || !this.clickpesa) return;
    const staleMs = Math.max(
      this.config.reconciliation.staleSeconds * 1000,
      MIN_SUBMISSION_COOLDOWN_MS,
    );
    const now = new Date();
    const cutoff = new Date(now.getTime() - staleMs);
    const eligible = await this.prisma.transaction.updateMany({
      where: {
        id: transaction.id,
        status: 'processing',
        provider: 'clickpesa',
        providerRef: null,
        OR: [
          { providerSubmissionAt: null },
          { providerSubmissionAt: { lt: cutoff } },
        ],
      },
      data: { providerSubmissionAt: now },
    });
    if (eligible.count !== 1) return;

    const slot = await this.prisma.paymentProviderSettings.updateMany({
      where: {
        id: 'payment-provider-settings',
        OR: [
          { clickpesaLastPayoutAt: null },
          {
            clickpesaLastPayoutAt: {
              lte: new Date(now.getTime() - MIN_SUBMISSION_COOLDOWN_MS),
            },
          },
        ],
      },
      data: { clickpesaLastPayoutAt: now },
    });
    if (slot.count !== 1) return;

    const metadata =
      typeof transaction.metadata === 'object' &&
      transaction.metadata !== null &&
      !Array.isArray(transaction.metadata)
        ? transaction.metadata
        : {};
    try {
      const payout =
        transaction.channel === 'bank'
          ? await this.clickpesa.createBankPayout({
              amount: Number(transaction.amount),
              currency: 'TZS',
              orderReference,
              accountNumber: decryptField(
                typeof metadata.encryptedAccountNumber === 'string'
                  ? metadata.encryptedAccountNumber
                  : '',
                this.config.paymentMethodEncryptionKey,
                BANK_DATA_ENCRYPTION_OPTIONS,
              ),
              accountName: decryptField(
                typeof metadata.encryptedAccountName === 'string'
                  ? metadata.encryptedAccountName
                  : '',
                this.config.paymentMethodEncryptionKey,
                BANK_DATA_ENCRYPTION_OPTIONS,
              ),
              bic:
                typeof metadata.bankBic === 'string'
                  ? metadata.bankBic
                  : '',
              accountCurrency: 'TZS',
            })
          : await this.clickpesa.createMobileMoneyPayout({
              amount: Number(transaction.amount),
              currency: 'TZS',
              orderReference,
              phoneNumber: transaction.counterparty,
            });
      if (!this.matchesClickPesaPayout(transaction, payout)) {
        this.logger.warn(
          `ClickPesa payout resubmission details do not match ${transaction.reference}; leaving it unsettled`,
        );
        return;
      }
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          providerRef: payout.id,
          internalReference: orderReference,
          providerStatus: payout.status,
        },
      });
    } catch (error) {
      if (
        error instanceof ClickPesaProviderError &&
        error.statusCode === 409
      ) {
        try {
          const existing = await this.clickpesa.getPayout(orderReference);
          if (existing && this.matchesClickPesaPayout(transaction, existing)) {
            await this.prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                providerRef: existing.id,
                internalReference: orderReference,
                providerStatus: existing.status,
              },
            });
            return;
          }
        } catch (lookupError) {
          this.logger.warn(
            `ClickPesa duplicate payout lookup for ${transaction.reference} remains uncertain: ${
              lookupError instanceof Error ? lookupError.message : 'provider lookup failed'
            }`,
          );
          return;
        }
        this.logger.warn(
          `ClickPesa duplicate payout status is not available for ${transaction.reference}; keeping its hold`,
        );
      } else if (error instanceof ClickPesaProviderError && !error.retryable) {
        await this.settlement.failWithdrawal(transaction);
        this.logger.warn(
          `ClickPesa definitively rejected payout ${transaction.reference}; its hold was released`,
        );
      } else if (error instanceof Error) {
        this.logger.warn(
          `ClickPesa payout recovery for ${transaction.reference} remains pending: ${error.message}`,
        );
      }
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private wholeAmount(value: unknown): bigint | null {
    if (typeof value === 'number') {
      return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
    }
    if (typeof value !== 'string' || !/^\d+(?:\.0+)?$/.test(value)) return null;
    try {
      return BigInt(value.split('.')[0]!);
    } catch {
      return null;
    }
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
