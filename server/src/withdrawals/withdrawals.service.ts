import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  MOBILE_NETWORK_LABEL,
  type AblinerWithdrawalData,
  type WithdrawalInput,
  type WithdrawalResult,
} from '@mori-pay/contracts';

import {
  AblinerClient,
  AblinerProviderError,
} from '../abliner/abliner.client.js';
import { AuthService } from '../auth/auth.service.js';
import { generateReference } from '../common/crypto.js';
import { InsufficientFundsError } from '../common/errors.js';
import { createTransactionNotification } from '../account/notification-writer.js';
import { Prisma, type Transaction } from '../generated/prisma/client.js';
import { FeesService, type FeeDetail } from '../payments/fees.service.js';
import { LimitsService } from '../limits/limits.service.js';
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
    private readonly limits: LimitsService,
  ) {}

  /** Returns the approved customer fee; provider costs are not passed through. */
  async resolveFeeDetail(amount: bigint): Promise<FeeDetail> {
    return this.fees.resolveFeeDetail({
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
    if (input.idempotencyKey) {
      const existing = await this.prisma.transaction.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) {
        this.assertRetryMatches(existing, amount, input.phoneNumber);
        return {
          transaction: toTransaction(existing),
          fee: Number(existing.fee),
        };
      }
    }

    const feeDetail = await this.resolveFeeDetail(amount);
    const fee = feeDetail.fee;
    if (
      input.expectedFee !== undefined &&
      BigInt(input.expectedFee) !== fee
    ) {
      throw new ConflictException(
        'The withdrawal fee changed. Review the updated fee and total before confirming.',
      );
    }
    await this.limits.assertWithinLimits(user.id, user.tier, amount + fee);

    const available =
      user.wallet?.ledgerAccounts.find(
        (account) => account.kind === LEDGER_ACCOUNT_AVAILABLE,
      )?.balance ?? 0n;
    if (available < amount + fee) throw new InsufficientFundsError();

    let result: {
      transaction: Transaction;
      isNew: boolean;
    };
    try {
      result = await this.prisma.$transaction(async (client) => {
      if (input.idempotencyKey) {
        const existing = await client.transaction.findUnique({
          where: {
            userId_idempotencyKey: {
              userId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (existing) {
          this.assertRetryMatches(existing, amount, input.phoneNumber);
          return { transaction: existing, isNew: false };
        }
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
          feeFlat: feeDetail.flat,
          feePercentage: feeDetail.percentage,
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

      await createTransactionNotification(client, transaction);
      await this.settlement.postWithdrawalHold(transaction, client);
      return { transaction, isNew: true };
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
      this.assertRetryMatches(existing, amount, input.phoneNumber);
      return {
        transaction: toTransaction(existing),
        fee: Number(existing.fee),
      };
    }
    const created = result.transaction;

    if (!result.isNew || created.providerRef || created.status !== 'processing') {
      return {
        transaction: toTransaction(created),
        fee: Number(result.isNew ? fee : created.fee),
      };
    }

    let payout: AblinerWithdrawalData;
    try {
      payout = await this.abliner.createWithdrawal({
        amount: input.amount,
        method: 'mobile',
        currency: 'TZS',
        recipient: input.phoneNumber,
        reference: created.reference,
      });
    } catch (error) {
      if (error instanceof AblinerProviderError && error.retryable) {
        this.logger.warn(
          `Abliner outcome is unknown for withdrawal ${created.reference}; keeping its hold for reconciliation`,
        );
      } else {
        await this.settlement.failWithdrawal(created);
      }
      throw error;
    }

    const updated = await this.prisma.transaction.update({
      where: { id: created.id },
      data: {
        providerRef: payout.id,
        providerStatus: payout.status,
        internalReference: payout.id,
      },
    });

    return { transaction: toTransaction(updated), fee: Number(fee) };
  }

  private assertRetryMatches(
    transaction: {
      type: string;
      channel: string;
      amount: bigint;
      counterparty: string;
    },
    amount: bigint,
    recipientPhone: string,
  ): void {
    if (
      transaction.type !== 'withdrawal' ||
      transaction.channel !== 'mobileMoney' ||
      transaction.amount !== amount ||
      transaction.counterparty !== recipientPhone
    ) {
      throw new BadRequestException(
        'This withdrawal retry does not match the original request.',
      );
    }
  }
}
