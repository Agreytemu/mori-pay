import { Injectable, NotFoundException } from '@nestjs/common';

import type {
  Merchant,
  PayMerchantInput,
  PayMerchantResult,
} from '@mori-pay/contracts';

import { AuthService } from '../auth/auth.service.js';
import { SYSTEM_LEDGER_ACCOUNTS } from '../ledger/ledger.service.js';
import { FeesService } from '../payments/fees.service.js';
import { PaymentsService } from '../payments/payments.service.js';
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
    const fee = await this.fees.resolveFee({
      type: 'payment',
      channel: 'wallet',
      amount,
    });

    const transaction = await this.payments.paySystem({
      from: payer,
      system: SYSTEM_LEDGER_ACCOUNTS.merchant,
      amount,
      fee,
      note: input.note,
      type: 'payment',
      category: 'merchant',
      counterparty: merchant.name,
      counterpartyDetail: merchant.identifier,
      idempotencyKey: input.idempotencyKey,
      metadata: { merchantId: merchant.id },
    });

    return { transaction, merchantName: merchant.name, fee: Number(fee) };
  }
}
