import { Injectable, NotFoundException } from '@nestjs/common';

import type {
  Merchant,
  MerchantPaymentPreview,
  MerchantPaymentPreviewInput,
  PayMerchantInput,
  PayMerchantResult,
} from '@mori-pay/contracts';

import { AuthService } from '../auth/auth.service.js';
import { SYSTEM_LEDGER_ACCOUNTS } from '../ledger/ledger.service.js';
import { FeesService } from '../payments/fees.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { LimitsService } from '../limits/limits.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletService } from '../wallet/wallet.service.js';

@Injectable()
export class MerchantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly payments: PaymentsService,
    private readonly fees: FeesService,
    private readonly auth: AuthService,
    private readonly limits: LimitsService,
  ) {}

  async list(): Promise<Merchant[]> {
    const merchants = await this.prisma.merchant.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });

    return merchants.map((merchant) => ({
      id: merchant.id,
      name: merchant.name,
      identifier: merchant.identifier,
      category: merchant.category,
      phoneNumber: merchant.phone ?? undefined,
    }));
  }

  async preview(input: MerchantPaymentPreviewInput): Promise<MerchantPaymentPreview> {
    const merchant = await this.prisma.merchant.findFirst({
      where: {
        active: true,
        OR: [{ id: input.merchantId }, { identifier: input.merchantId }],
      },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');

    const amount = BigInt(input.amount);
    const feeDetail = await this.fees.resolveFeeDetail({
      type: 'payment',
      channel: 'wallet',
      amount,
    });
    return {
      merchantName: merchant.name,
      amount: input.amount,
      fee: Number(feeDetail.fee),
      feePercentage: feeDetail.percentage,
      total: Number(amount + feeDetail.fee),
    };
  }

  async pay(userId: string, input: PayMerchantInput): Promise<PayMerchantResult> {
    const payer = await this.wallet.loadUserWithWallet(userId);

    const merchant = await this.prisma.merchant.findFirst({
      where: {
        active: true,
        OR: [{ id: input.merchantId }, { identifier: input.merchantId }],
      },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');

    await this.auth.verifyPin(userId, input.pin);

    const amount = BigInt(input.amount);
    const feeDetail = await this.fees.resolveFeeDetail({
      type: 'payment',
      channel: 'wallet',
      amount,
    });
    await this.limits.assertWithinLimits(
      payer.id,
      payer.tier,
      amount + feeDetail.fee,
    );

    const transaction = await this.payments.paySystem({
      from: payer,
      system: SYSTEM_LEDGER_ACCOUNTS.merchant,
      amount,
      fee: feeDetail.fee,
      feeDetail,
      note: input.note,
      type: 'payment',
      category: 'merchant',
      counterparty: merchant.name,
      counterpartyDetail: merchant.identifier,
      idempotencyKey: input.idempotencyKey,
      metadata: { merchantId: merchant.id },
    });

    return { transaction, merchantName: merchant.name, fee: Number(feeDetail.fee) };
  }
}
