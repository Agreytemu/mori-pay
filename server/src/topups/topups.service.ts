import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  mobileNetworkDisplayName,
  type AblinerDepositData,
  type CardTopupResult,
  type FeePreview,
  type TopupCardInput,
  type TopupInitResult,
  type TopupMobileMoneyInput,
} from '@mori-pay/contracts';

import {
  AblinerClient,
  AblinerProviderError,
} from '../abliner/abliner.client.js';
import { generateReference } from '../common/crypto.js';
import { ProviderError } from '../common/errors.js';
import { decryptPaymentMethodPhone } from '../common/payment-method-crypto.js';
import { createTransactionNotification } from '../account/notification-writer.js';
import { AppConfigService } from '../config/app-config.service.js';
import { Prisma, type Transaction } from '../generated/prisma/client.js';
import { FeesService, type FeeDetail } from '../payments/fees.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toTransaction } from '../wallet/wallet.mapper.js';

/**
 * Initiates wallet top-ups through Abliner. The user's balance is only
 * credited once the provider confirms success via webhook reconciliation.
 *
 * The database row is created first so its id can be used as the Abliner
 * `Idempotency-Key`: a retried request never charges the customer twice.
 */
@Injectable()
export class TopUpsService {
  private readonly logger = new Logger(TopUpsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly abliner: AblinerClient,
    private readonly config: AppConfigService,
    private readonly fees: FeesService,
  ) {}

  async previewCard(amount: bigint): Promise<FeePreview> {
    return this.previewDeposit(amount, 'card');
  }

  async previewMobileMoney(amount: bigint): Promise<FeePreview> {
    return this.previewDeposit(amount, 'mobileMoney');
  }

  private async previewDeposit(
    amount: bigint,
    channel: 'card' | 'mobileMoney',
  ): Promise<FeePreview> {
    const feeDetail = await this.fees.resolveFeeDetail({
      type: 'deposit',
      channel,
      amount,
    });
    return {
      amount: Number(amount),
      fee: Number(feeDetail.fee),
      feePercentage: feeDetail.percentage,
      total: Number(amount + feeDetail.fee),
    };
  }

  async initiateMobileMoney(
    userId: string,
    input: TopupMobileMoneyInput,
  ): Promise<TopupInitResult> {
    const amount = BigInt(input.amount);
    let mobileNumber = input.mobileNumber;
    let network = input.network;
    if (input.savedPaymentMethodId) {
      const savedMethod = await this.prisma.savedPaymentMethod.findFirst({
        where: {
          id: input.savedPaymentMethodId,
          userId,
          kind: 'mobile-money',
          status: 'Active',
        },
      });
      if (!savedMethod?.encryptedPhoneNumber) {
        throw new BadRequestException(
          'That saved mobile-money method is unavailable. Choose another number or add a new method.',
        );
      }
      mobileNumber = decryptPaymentMethodPhone(
        savedMethod.encryptedPhoneNumber,
        this.config.paymentMethodEncryptionKey,
      );
      network = savedMethod.network ?? savedMethod.provider;
    }
    if (!mobileNumber) {
      throw new BadRequestException(
        'Provide a mobile number or choose a saved mobile-money method.',
      );
    }
    const reference = generateReference('DEP');

    let result: { transaction: Transaction; isNew: boolean };
    const previous = input.idempotencyKey
      ? await this.prisma.transaction.findUnique({
          where: {
            userId_idempotencyKey: {
              userId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        })
      : null;

    if (previous) {
      if (
        previous.type !== 'deposit' ||
        previous.channel !== 'mobileMoney' ||
        previous.amount !== amount ||
        previous.counterparty !== mobileNumber
      ) {
        throw new BadRequestException(
          'This payment retry does not match the original request.',
        );
      }
      result = { transaction: previous, isNew: false };
    } else {
      const configuredFee = await this.fees.resolveFeeDetail({
        type: 'deposit',
        channel: 'mobileMoney',
        amount,
      });
      if (
        input.expectedFee !== undefined &&
        BigInt(input.expectedFee) !== configuredFee.fee
      ) {
        throw new ConflictException(
          'The mobile-money fee changed. Review the updated fee and total before continuing.',
        );
      }

    try {
      result = await this.prisma.$transaction(async (tx) => {
        if (input.idempotencyKey) {
          const existing = await tx.transaction.findUnique({
            where: {
              userId_idempotencyKey: {
                userId,
                idempotencyKey: input.idempotencyKey,
              },
            },
          });
          if (existing) {
            if (
              existing.type !== 'deposit' ||
              existing.channel !== 'mobileMoney' ||
              existing.amount !== amount ||
              existing.counterparty !== mobileNumber
            ) {
              throw new BadRequestException(
                'This payment retry does not match the original request.',
              );
            }
            if (
              input.expectedFee !== undefined &&
              BigInt(input.expectedFee) !== existing.fee
            ) {
              throw new ConflictException(
                'The mobile-money fee changed. Review the updated fee and total before continuing.',
              );
            }
            return { transaction: existing, isNew: false };
          }
        }

        const created = await tx.transaction.create({
          data: {
            userId,
            reference,
            type: 'deposit',
            status: 'pending',
            category: 'topUp',
            channel: 'mobileMoney',
            direction: 'credit',
            amount,
            fee: configuredFee.fee,
            feeFlat: configuredFee.flat,
            feePercentage: configuredFee.percentage,
            total: amount + configuredFee.fee,
            counterparty: mobileNumber,
            counterpartyDetail: network
              ? mobileNetworkDisplayName(network)
              : 'Mobile money',
            provider: 'abliner',
            providerStatus: 'pending',
            idempotencyKey: input.idempotencyKey ?? null,
            metadata: { network: network ?? null },
          },
        });
        await createTransactionNotification(tx, created);
        return { transaction: created, isNew: true };
      });
    } catch (error) {
      if (
        !input.idempotencyKey ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      const existing = await this.prisma.transaction.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (!existing) throw error;
      if (
        existing.type !== 'deposit' ||
        existing.channel !== 'mobileMoney' ||
        existing.amount !== amount ||
        existing.counterparty !== mobileNumber
      ) {
        throw new BadRequestException(
          'This payment retry does not match the original request.',
        );
      }
      if (
        input.expectedFee !== undefined &&
        BigInt(input.expectedFee) !== existing.fee
      ) {
        throw new ConflictException(
          'The mobile-money fee changed. Review the updated fee and total before continuing.',
        );
      }
      result = { transaction: existing, isNew: false };
    }
    }
    const transaction = result.transaction;
    if (!result.isNew && transaction.status === 'failed') {
      throw new BadRequestException(
        'This payment attempt failed. Start a new payment to try again.',
      );
    }
    if (!result.isNew && transaction.status === 'completed') {
      return {
        transaction: toTransaction(transaction),
        instructions: 'This payment has already been completed.',
      };
    }

    let deposit: AblinerDepositData;
    try {
      deposit = await this.abliner.createDeposit({
        amount: Number(transaction.total),
        method: 'mobile',
        currency: 'TZS',
        phone: mobileNumber,
        reference: transaction.reference,
        callbackUrl: this.config.abliner.callbackUrl,
        idempotencyKey: transaction.id,
      });
    } catch (error) {
      if (error instanceof AblinerProviderError && error.retryable) {
        this.logger.warn(
          `Abliner outcome is unknown for deposit ${transaction.reference}; leaving it pending for reconciliation`,
        );
      } else {
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'failed', providerStatus: 'failed' },
        });
      }
      throw error;
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        providerRef: deposit.id,
        internalReference: deposit.id,
        providerStatus: deposit.status,
        metadata: {
          network: input.network ?? null,
          ablinerReference: deposit.reference,
        },
      },
    });

    return {
      transaction: toTransaction(updated),
      instructions:
        deposit.message ??
        'Approve the payment prompt sent to your phone to complete the top-up.',
    };
  }

  async initiateCard(
    userId: string,
    input: TopupCardInput,
  ): Promise<CardTopupResult> {
    const amount = BigInt(input.amount);
    const existing = input.idempotencyKey
      ? await this.prisma.transaction.findUnique({
          where: {
            userId_idempotencyKey: {
              userId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        })
      : null;
    if (
      existing &&
      (existing.type !== 'deposit' ||
        existing.channel !== 'card' ||
        existing.amount !== amount)
    ) {
      throw new BadRequestException(
        'This payment retry does not match the original request.',
      );
    }
    const feeDetail: FeeDetail = existing
      ? {
          fee: existing.fee,
          flat: existing.feeFlat,
          percentage: existing.feePercentage,
          ruleId: null,
        }
      : await this.fees.resolveFeeDetail({
          type: 'deposit',
          channel: 'card',
          amount,
        });
    if (
      input.expectedFee !== undefined &&
      BigInt(input.expectedFee) !== feeDetail.fee
    ) {
      throw new ConflictException(
        'The card fee changed. Review the updated fee and total before continuing.',
      );
    }
    const total = amount + feeDetail.fee;
    const reference = generateReference('DEP');

    let result: { transaction: Transaction; isNew: boolean };
    try {
      result = await this.prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.transaction.findUnique({
          where: {
            userId_idempotencyKey: {
              userId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (existing) {
          if (
            existing.type !== 'deposit' ||
            existing.channel !== 'card' ||
            existing.amount !== amount
          ) {
            throw new BadRequestException(
              'This payment retry does not match the original request.',
            );
          }
          return { transaction: existing, isNew: false };
        }
      }

      const created = await tx.transaction.create({
        data: {
          userId,
          reference,
          type: 'deposit',
          status: 'pending',
          category: 'topUp',
          channel: 'card',
          direction: 'credit',
          amount,
          fee: feeDetail.fee,
          feeFlat: feeDetail.flat,
          feePercentage: feeDetail.percentage,
          total,
          counterparty: input.customerName ?? 'Card payment',
          counterpartyDetail: input.customerEmail ?? null,
          provider: 'abliner',
          providerStatus: 'pending',
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });
      await createTransactionNotification(tx, created);
      return { transaction: created, isNew: true };
      });
    } catch (error) {
      if (
        !input.idempotencyKey ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      const existing = await this.prisma.transaction.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (!existing) throw error;
      if (
        existing.type !== 'deposit' ||
        existing.channel !== 'card' ||
        existing.amount !== amount
      ) {
        throw new BadRequestException(
          'This payment retry does not match the original request.',
        );
      }
      result = { transaction: existing, isNew: false };
    }
    const transaction = result.transaction;
    if (!result.isNew && transaction.status === 'failed') {
      throw new BadRequestException(
        'This payment attempt failed. Start a new payment to try again.',
      );
    }
    if (!result.isNew && transaction.status === 'completed') {
      const metadata =
        transaction.metadata && typeof transaction.metadata === 'object'
          ? transaction.metadata
          : null;
      const checkoutUrl =
        metadata && 'checkoutUrl' in metadata &&
        typeof metadata.checkoutUrl === 'string'
          ? metadata.checkoutUrl
          : null;
      if (checkoutUrl) {
        return { transaction: toTransaction(transaction), checkoutUrl };
      }
      throw new ProviderError('The original checkout details are unavailable.');
    }

    let deposit: AblinerDepositData;
    try {
      deposit = await this.abliner.createDeposit({
        amount: Number(transaction.total),
        method: 'card',
        currency: 'TZS',
        phone: input.customerPhone,
        reference: transaction.reference,
        callbackUrl: this.config.abliner.callbackUrl,
        idempotencyKey: transaction.id,
      });
    } catch (error) {
      this.logger.error(
        `Card top-up failed for ${transaction.reference}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      if (error instanceof AblinerProviderError && error.retryable) {
        this.logger.warn(
          `Abliner outcome is unknown for card deposit ${transaction.reference}; leaving it pending for reconciliation`,
        );
      } else {
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'failed', providerStatus: 'failed' },
        });
      }
      throw error;
    }

    if (!deposit.payment_url) {
      this.logger.error(`Card checkout URL missing for ${transaction.reference}`);
      throw new ProviderError('Card checkout is temporarily unavailable.');
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        providerRef: deposit.id,
        internalReference: deposit.id,
        providerStatus: deposit.status,
        metadata: {
          checkoutUrl: deposit.payment_url,
          ablinerReference: deposit.reference,
        },
      },
    });

    return {
      transaction: toTransaction(updated),
      checkoutUrl: deposit.payment_url,
    };
  }
}
