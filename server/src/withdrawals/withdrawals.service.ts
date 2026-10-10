import { Injectable } from '@nestjs/common';

import {
  STAKABA_NETWORK_LABEL,
  type WithdrawalInput,
  type WithdrawalResult,
} from '@mori-pay/contracts';

import { AuthService } from '../auth/auth.service.js';
import { generateReference } from '../common/crypto.js';
import { InsufficientFundsError } from '../common/errors.js';
import { FeesService } from '../payments/fees.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettlementService } from '../settlement/settlement.service.js';
import { StakabaClient } from '../stakaba/stakaba.client.js';
import { LEDGER_ACCOUNT_AVAILABLE, toTransaction } from '../wallet/wallet.mapper.js';
import { WalletService } from '../wallet/wallet.service.js';

/**
 * Wallet-to-mobile-money payouts. Funds are held on the ledger up front so the
 * balance cannot be double-spent; the hold is released to the outside world on
 * success or returned to the user on failure (see webhook reconciliation).
 */
@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly fees: FeesService,
    private readonly auth: AuthService,
    private readonly stakaba: StakabaClient,
    private readonly settlement: SettlementService,
  ) {}

  async create(
    userId: string,
    input: WithdrawalInput,
  ): Promise<WithdrawalResult> {
    const user = await this.wallet.loadUserWithWallet(userId);
    await this.auth.verifyPin(userId, input.pin);

    const amount = BigInt(input.amount);
    const fee = await this.fees.resolveFee({
      type: 'withdrawal',
      channel: 'mobileMoney',
      amount,
    });

    const available =
      user.wallet?.ledgerAccounts.find(
        (account) => account.kind === LEDGER_ACCOUNT_AVAILABLE,
      )?.balance ?? 0n;
    if (available < amount + fee) throw new InsufficientFundsError();

    const created = await this.prisma.$transaction(async (client) => {
      if (input.idempotencyKey) {
        const existing = await client.transaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) return existing;
      }

      const transaction = await client.transaction.create({
        data: {
          userId,
          reference: generateReference('WDR'),
          type: 'withdrawal',
          status: 'processing',
          category: 'transfer',
          channel: 'mobileMoney',
          direction: 'debit',
          amount,
          fee,
          total: amount + fee,
          counterparty: input.phoneNumber,
          counterpartyDetail: STAKABA_NETWORK_LABEL[input.network],
          provider: 'stakaba',
          providerStatus: 'processing',
          idempotencyKey: input.idempotencyKey ?? null,
          metadata: {
            network: input.network,
            accountName: input.accountName ?? null,
          },
        },
      });

      await this.settlement.postWithdrawalHold(transaction, client);
      return transaction;
    });

    if (created.providerRef || created.status !== 'processing') {
      return { transaction: toTransaction(created), fee: Number(fee) };
    }

    try {
      const payout = await this.stakaba.createPayout({
        amount: input.amount,
        currency: 'TZS',
        destinationType: 'mobile_money',
        destinationDetails: {
          phoneNumber: input.phoneNumber,
          network: input.network,
          accountName: input.accountName,
        },
      });

      const updated = await this.prisma.transaction.update({
        where: { id: created.id },
        data: {
          providerRef: payout.disbursement.id,
          providerStatus: payout.disbursement.status,
          internalReference: payout.disbursement.id,
        },
      });

      return { transaction: toTransaction(updated), fee: Number(fee) };
    } catch (error) {
      await this.settlement.failWithdrawal(created);
      throw error;
    }
  }
}
