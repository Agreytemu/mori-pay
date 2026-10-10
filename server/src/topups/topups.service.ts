import { Injectable } from '@nestjs/common';

import {
  STAKABA_NETWORK_LABEL,
  type CardTopupResult,
  type TopupCardInput,
  type TopupInitResult,
  type TopupMobileMoneyInput,
} from '@mori-pay/contracts';

import { generateReference } from '../common/crypto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StakabaClient } from '../stakaba/stakaba.client.js';
import { toTransaction } from '../wallet/wallet.mapper.js';

/**
 * Initiates wallet top-ups through Stakaba. The user's balance is only
 * credited once the provider confirms success via webhook reconciliation.
 */
@Injectable()
export class TopUpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stakaba: StakabaClient,
  ) {}

  async initiateMobileMoney(
    userId: string,
    input: TopupMobileMoneyInput,
  ): Promise<TopupInitResult> {
    const amount = BigInt(input.amount);

    const collection = await this.stakaba.createCollection({
      grossAmount: input.amount,
      currency: 'TZS',
      mobileNumber: input.mobileNumber,
      network: input.network,
      metadata: { userId },
    });

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        reference: generateReference('DEP'),
        type: 'deposit',
        status: 'pending',
        category: 'topUp',
        channel: 'mobileMoney',
        direction: 'credit',
        amount,
        fee: 0n,
        total: amount,
        counterparty: input.mobileNumber,
        counterpartyDetail: STAKABA_NETWORK_LABEL[input.network],
        provider: 'stakaba',
        providerStatus: 'pending',
        internalReference: collection.internalReference,
        metadata: { network: input.network },
      },
    });

    return {
      transaction: toTransaction(transaction),
      instructions:
        'Approve the payment prompt sent to your phone to complete the top-up.',
    };
  }

  async initiateCard(
    userId: string,
    input: TopupCardInput,
  ): Promise<CardTopupResult> {
    const amount = BigInt(input.amount);

    const card = await this.stakaba.createCardPayment({
      grossAmount: input.amount,
      currency: 'TZS',
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      billingAddress: input.billingAddress,
      postalCode: input.postalCode,
      metadata: { userId },
    });

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        reference: generateReference('DEP'),
        type: 'deposit',
        status: 'pending',
        category: 'topUp',
        channel: 'card',
        direction: 'credit',
        amount,
        fee: 0n,
        total: amount,
        counterparty: input.customerName,
        counterpartyDetail: input.customerEmail,
        provider: 'stakaba',
        providerStatus: 'pending',
        internalReference: card.internalReference,
        metadata: { checkoutUrl: card.checkoutUrl },
      },
    });

    return { transaction: toTransaction(transaction), checkoutUrl: card.checkoutUrl };
  }
}
