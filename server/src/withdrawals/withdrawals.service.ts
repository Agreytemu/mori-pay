import { Injectable, Logger } from '@nestjs/common';

import {
  MOBILE_NETWORK_LABEL,
  type WithdrawalInput,
  type WithdrawalResult,
} from '@mori-pay/contracts';

import { AblinerClient } from '../abliner/abliner.client.js';
import { AuthService } from '../auth/auth.service.js';
import { generateReference } from '../common/crypto.js';
import { InsufficientFundsError } from '../common/errors.js';
import { FeesService } from '../payments/fees.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettlementService } from '../settlement/settlement.service.js';
import { LEDGER_ACCOUNT_AVAILABLE, toTransaction } from '../wallet/wallet.mapper.js';
import { WalletService } from '../wallet/wallet.service.js';

export type RecipientLookupResult = {
  found: boolean;
  phoneNumber: string;
  name?: string;
  network?: string;
};

/**
 * Wallet-to-mobile-money payouts. Funds are held on the ledger up front so the
 * balance cannot be double-spent; the hold is released to the outside world on
 * success or returned to the user on failure (see webhook reconciliation).
 */
@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly fees: FeesService,
    private readonly auth: AuthService,
    private readonly abliner: AblinerClient,
    private readonly settlement: SettlementService,
  ) {}

  /** Resolves the payout fee, preferring Abliner's live quote. */
  async resolveFee(amount: bigint): Promise<bigint> {
    try {
      const preview = await this.abliner.previewWithdrawal('mobile', Number(amount));
      if (preview.fee_tzs > 0) return BigInt(preview.fee_tzs);
    } catch (error) {
      this.logger.warn(
        `Abliner withdrawal preview failed, using local fee rule: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return this.fees.resolveFee({
      type: 'withdrawal',
      channel: 'mobileMoney',
      amount,
    });
  }

  /** Confirms the registered name of a payout recipient before sending. */
  async lookupRecipient(phone: string): Promise<RecipientLookupResult> {
    try {
      const result = await this.abliner.lookupPhone(phone);
      return {
        found: true,
        phoneNumber: result.phone,
        name: result.name,
        network: result.network,
      };
    } catch (error) {
      this.logger.warn(
        `Abliner lookup failed for ${phone}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { found: false, phoneNumber: phone };
    }
  }

  async create(
    userId: string,
    input: WithdrawalInput,
  ): Promise<WithdrawalResult> {
    const user = await this.wallet.loadUserWithWallet(userId);
    await this.auth.verifyPin(userId, input.pin);

    const amount = BigInt(input.amount);
    const fee = await this.resolveFee(amount);

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
          counterpartyDetail: input.network
            ? MOBILE_NETWORK_LABEL[input.network]
            : 'Mobile money',
          provider: 'abliner',
          providerStatus: 'processing',
          idempotencyKey: input.idempotencyKey ?? null,
          metadata: {
            network: input.network ?? null,
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
      const payout = await this.abliner.createWithdrawal({
        amount: input.amount,
        method: 'mobile',
        currency: 'TZS',
        recipient: input.phoneNumber,
        reference: created.reference,
      });

      const updated = await this.prisma.transaction.update({
        where: { id: created.id },
        data: {
          providerRef: payout.id,
          providerStatus: payout.status,
          internalReference: payout.id,
        },
      });

      return { transaction: toTransaction(updated), fee: Number(fee) };
    } catch (error) {
      await this.settlement.failWithdrawal(created);
      throw error;
    }
  }
}
