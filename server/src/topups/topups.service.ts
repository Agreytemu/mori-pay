import { Injectable, Logger } from '@nestjs/common';

import {
  MOBILE_NETWORK_LABEL,
  type CardTopupResult,
  type TopupCardInput,
  type TopupInitResult,
  type TopupMobileMoneyInput,
} from '@mori-pay/contracts';

import { AblinerClient } from '../abliner/abliner.client.js';
import { generateReference } from '../common/crypto.js';
import { ProviderError } from '../common/errors.js';
import { AppConfigService } from '../config/app-config.service.js';
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
  ) {}

  async initiateMobileMoney(
    userId: string,
    input: TopupMobileMoneyInput,
  ): Promise<TopupInitResult> {
    const amount = BigInt(input.amount);
    const reference = generateReference('DEP');

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        reference,
        type: 'deposit',
        status: 'pending',
        category: 'topUp',
        channel: 'mobileMoney',
        direction: 'credit',
        amount,
        fee: 0n,
        total: amount,
        counterparty: input.mobileNumber,
        counterpartyDetail: input.network
          ? MOBILE_NETWORK_LABEL[input.network]
          : 'Mobile money',
        provider: 'abliner',
        providerStatus: 'pending',
        metadata: { network: input.network ?? null },
      },
    });

    try {
      const deposit = await this.abliner.createDeposit({
        amount: input.amount,
        method: 'mobile',
        currency: 'TZS',
        phone: input.mobileNumber,
        reference,
        callbackUrl: this.config.abliner.callbackUrl,
        idempotencyKey: transaction.id,
      });

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
    } catch (error) {
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'failed', providerStatus: 'failed' },
      });
      throw error;
    }
  }

  async initiateCard(
    userId: string,
    input: TopupCardInput,
  ): Promise<CardTopupResult> {
    const amount = BigInt(input.amount);
    const reference = generateReference('DEP');

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        reference,
        type: 'deposit',
        status: 'pending',
        category: 'topUp',
        channel: 'card',
        direction: 'credit',
        amount,
        fee: 0n,
        total: amount,
        counterparty: input.customerName ?? 'Card payment',
        counterpartyDetail: input.customerEmail ?? null,
        provider: 'abliner',
        providerStatus: 'pending',
      },
    });

    try {
      const deposit = await this.abliner.createDeposit({
        amount: input.amount,
        method: 'card',
        currency: 'TZS',
        phone: input.customerPhone,
        reference,
        callbackUrl: this.config.abliner.callbackUrl,
        idempotencyKey: transaction.id,
      });

      if (!deposit.payment_url) {
        throw new ProviderError('Card checkout URL was not returned');
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
    } catch (error) {
      this.logger.error(
        `Card top-up failed for ${reference}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'failed', providerStatus: 'failed' },
      });
      throw error;
    }
  }
}
