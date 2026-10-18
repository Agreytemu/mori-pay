import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';

import {
  mobileNetworkDisplayName,
  type AblinerWithdrawalData,
  type WithdrawalInput,
  type WithdrawalPreview,
  type WithdrawalPreviewInput,
  type WithdrawalResult,
} from '@mori-pay/contracts';

import {
  AblinerClient,
  AblinerProviderError,
} from '../abliner/abliner.client.js';
import {
  ClickPesaClient,
  ClickPesaProviderError,
} from '../clickpesa/clickpesa.client.js';
import type { ClickPesaBank, ClickPesaPayout } from '../clickpesa/clickpesa.types.js';
import { AuthService } from '../auth/auth.service.js';
import { generateReference } from '../common/crypto.js';
import { InsufficientFundsError } from '../common/errors.js';
import { decryptField, encryptField } from '../common/field-encryption.js';
import { maskPhoneNumber } from '../common/redact.js';
import { createTransactionNotification } from '../account/notification-writer.js';
import { Prisma, type Transaction } from '../generated/prisma/client.js';
import { AppConfigService } from '../config/app-config.service.js';
import { FeesService, type FeeDetail } from '../payments/fees.service.js';
import { PaymentProviderSettingsService } from '../payments/payment-provider-settings.service.js';
import { LimitsService } from '../limits/limits.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettlementService } from '../settlement/settlement.service.js';
import { LEDGER_ACCOUNT_AVAILABLE, toTransaction } from '../wallet/wallet.mapper.js';
import { WalletService } from '../wallet/wallet.service.js';

const BANK_DATA_ENCRYPTION_OPTIONS = {
  envName: 'PAYMENT_METHOD_ENCRYPTION_KEY',
  invalidMessage: 'Stored bank payout data is invalid.',
} as const;
const CLICKPESA_PAYOUT_COOLDOWN_MS = 60_000;

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
    @Optional()
    private readonly paymentProviderSettings?: PaymentProviderSettingsService,
    @Optional()
    private readonly clickpesa?: ClickPesaClient,
    @Optional()
    private readonly config?: AppConfigService,
  ) {}

  /** Returns the approved customer fee; provider costs are not passed through. */
  async resolveFeeDetail(
    amount: bigint,
    channel: 'mobileMoney' | 'bank' = 'mobileMoney',
  ): Promise<FeeDetail> {
    return this.fees.resolveFeeDetail({
      type: 'withdrawal',
      channel,
      amount,
    });
  }

  async preview(amount: bigint): Promise<WithdrawalPreview> {
    const provider = await this.providerForRail('mobileMoney');
    const feeDetail = await this.resolveFeeDetail(amount);
    if (provider === 'clickpesa') {
      return {
        amount: Number(amount),
        fee: Number(feeDetail.fee),
        feePercentage: feeDetail.percentage,
        total: Number(amount + feeDetail.fee),
        providerAvailable: false,
        availabilityMessage:
          'Enter the mobile-money number to preview a ClickPesa payout.',
        provider,
      };
    }
    try {
      await this.abliner.previewWithdrawal('mobile', Number(amount));
      return {
        amount: Number(amount),
        fee: Number(feeDetail.fee),
        feePercentage: feeDetail.percentage,
        total: Number(amount + feeDetail.fee),
        providerAvailable: true,
        provider: 'abliner',
      };
    } catch (error) {
      if (!(error instanceof AblinerProviderError)) throw error;
      this.logger.warn(
        `Abliner mobile withdrawal availability check failed: ${error.providerCode ?? 'provider check failed'}`,
      );
      return {
        amount: Number(amount),
        fee: Number(feeDetail.fee),
        feePercentage: feeDetail.percentage,
        total: Number(amount + feeDetail.fee),
        providerAvailable: false,
        availabilityMessage: error.message,
        provider: 'abliner',
      };
    }
  }

  async previewDestination(
    input: WithdrawalPreviewInput,
  ): Promise<WithdrawalPreview> {
    const amount = BigInt(input.amount);
    const provider = await this.providerForRail(input.rail);
    const feeDetail = await this.resolveFeeDetail(
      amount,
      input.rail === 'bank' ? 'bank' : 'mobileMoney',
    );
    if (provider === 'clickpesa') {
      if (!this.clickpesa) throw new Error('ClickPesa client is not registered');
      try {
        const orderReference = this.clickPesaOrderReference(generateReference('WDR'));
        const preview =
          input.rail === 'bank'
            ? await this.clickpesa.previewBankPayout({
                amount: input.amount,
                currency: 'TZS',
                orderReference,
                accountNumber: input.accountNumber,
                bic: input.bankBic,
                accountCurrency: 'TZS',
              })
            : await this.clickpesa.previewMobileMoneyPayout({
                amount: input.amount,
                currency: 'TZS',
                orderReference,
                phoneNumber: input.phoneNumber,
              });
        return {
          amount: input.amount,
          fee: Number(feeDetail.fee),
          feePercentage: feeDetail.percentage,
          total: Number(amount + feeDetail.fee),
          providerAvailable: true,
          provider,
          ...(preview.recipientName ? { recipientName: preview.recipientName } : {}),
        };
      } catch (error) {
        if (!(error instanceof ClickPesaProviderError)) throw error;
        this.logger.warn(
          `ClickPesa ${input.rail} payout availability check failed`,
        );
        return {
          amount: input.amount,
          fee: Number(feeDetail.fee),
          feePercentage: feeDetail.percentage,
          total: Number(amount + feeDetail.fee),
          providerAvailable: false,
          availabilityMessage: error.message,
          provider,
        };
      }
    }

    try {
      await this.abliner.previewWithdrawal('mobile', Number(amount));
      return {
        amount: Number(amount),
        fee: Number(feeDetail.fee),
        feePercentage: feeDetail.percentage,
        total: Number(amount + feeDetail.fee),
        providerAvailable: true,
        provider,
      };
    } catch (error) {
      if (!(error instanceof AblinerProviderError)) throw error;
      this.logger.warn(
        `Abliner mobile withdrawal availability check failed: ${error.providerCode ?? 'provider check failed'}`,
      );
      return {
        amount: Number(amount),
        fee: Number(feeDetail.fee),
        feePercentage: feeDetail.percentage,
        total: Number(amount + feeDetail.fee),
        providerAvailable: false,
        availabilityMessage: error.message,
        provider,
      };
    }
  }

  async listBanks(): Promise<ClickPesaBank[]> {
    await this.paymentProviderSettings?.assertEnabled('clickpesa');
    if (!this.clickpesa) throw new Error('ClickPesa client is not registered');
    return this.clickpesa.listBanks();
  }

  /** Confirms the registered name of a payout recipient before sending. */
  async lookupRecipient(phone: string): Promise<RecipientLookupResult> {
    const provider = await this.providerForRail('mobileMoney');
    if (provider === 'clickpesa') {
      return { found: false, phoneNumber: phone };
    }
    try {
      await this.paymentProviderSettings?.assertEnabled('abliner');
      const result = await this.abliner.lookupPhone(phone);
      return {
        found: true,
        phoneNumber: result.phone,
        name: result.name,
        network: result.network,
      };
    } catch (error) {
      this.logger.warn(
        `Abliner lookup failed for ${maskPhoneNumber(phone)}: ${
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
    const rail = input.rail ?? 'mobileMoney';
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
        this.assertRetryMatches(existing, amount, input, rail);
        return {
          transaction: toTransaction(existing),
          fee: Number(existing.fee),
        };
      }
    }
    const provider = await this.providerForRail(rail);
    await this.paymentProviderSettings?.assertEnabled(provider);

    const feeDetail = await this.resolveFeeDetail(
      amount,
      rail === 'bank' ? 'bank' : 'mobileMoney',
    );
    const fee = feeDetail.fee;
    if (
      input.expectedFee !== undefined &&
      BigInt(input.expectedFee) !== fee
    ) {
      throw new ConflictException(
        'The withdrawal fee changed. Review the updated fee and total before confirming.',
      );
    }

    const available =
      user.wallet?.ledgerAccounts.find(
        (account) => account.kind === LEDGER_ACCOUNT_AVAILABLE,
      )?.balance ?? 0n;
    if (available < amount + fee) throw new InsufficientFundsError();
    if (rail === 'bank') {
      if (!input.bankBic || !input.bankName || !input.accountNumber || !input.accountName) {
        throw new BadRequestException('Complete the bank account details.');
      }
      if (!this.config?.paymentMethodEncryptionKey) {
        throw new BadRequestException(
          'Bank payouts are unavailable because secure account storage is not configured.',
        );
      }
      if (!this.clickpesa) throw new Error('ClickPesa client is not registered');
      const selectedBank = (await this.clickpesa.listBanks()).find(
        (bank) => bank.bic === input.bankBic,
      );
      if (!selectedBank || selectedBank.name !== input.bankName) {
        throw new BadRequestException(
          'Choose a supported bank from the current ClickPesa bank list.',
        );
      }
      const preview = await this.previewDestination({
        amount: input.amount,
        rail,
        bankBic: input.bankBic,
        accountNumber: input.accountNumber,
        accountName: input.accountName,
      });
      if (!preview.providerAvailable) {
        throw new BadRequestException(
          preview.availabilityMessage ?? 'This bank account could not be verified.',
        );
      }
      if (
        preview.recipientName &&
        this.normalizeAccountName(preview.recipientName) !==
          this.normalizeAccountName(input.accountName)
      ) {
        throw new ConflictException(
          'The bank account name does not match the verified account holder.',
        );
      }
    }
    if (rail === 'mobileMoney' && !input.phoneNumber) {
      throw new BadRequestException('A mobile-money number is required.');
    }
    if (rail === 'mobileMoney' && provider === 'clickpesa') {
      const preview = await this.previewDestination({
        amount: input.amount,
        rail,
        phoneNumber: input.phoneNumber!,
      });
      if (!preview.providerAvailable) {
        throw new BadRequestException(
          preview.availabilityMessage ?? 'This mobile-money payout is unavailable.',
        );
      }
    }

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
          this.assertRetryMatches(existing, amount, input, rail);
          return { transaction: existing, isNew: false };
        }
      }

      await this.limits.assertWithinLimitsForUpdate(
        client,
        user.id,
        user.tier,
        amount + fee,
      );

      const transaction = await client.transaction.create({
        data: {
          userId,
          reference: generateReference('WDR'),
          type: 'withdrawal',
          status: 'processing',
          category: 'transfer',
          channel: rail === 'bank' ? 'bank' : 'mobileMoney',
          direction: 'debit',
          amount,
          fee,
          feeFlat: feeDetail.flat,
          feePercentage: feeDetail.percentage,
          total: amount + fee,
          counterparty:
            rail === 'bank' ? input.bankName! : input.phoneNumber!,
          counterpartyDetail:
            rail === 'bank'
              ? `${input.bankName} ••••${input.accountNumber!.slice(-4)}`
              : input.network
                ? mobileNetworkDisplayName(input.network)
                : 'Mobile money',
          provider,
          providerStatus: 'processing',
          idempotencyKey: input.idempotencyKey ?? null,
          metadata: {
            rail,
            network: input.network ?? null,
            ...(rail === 'bank'
              ? {
                  bankBic: input.bankBic,
                  bankName: input.bankName,
                  encryptedAccountNumber: encryptField(
                    input.accountNumber!,
                    this.config?.paymentMethodEncryptionKey,
                    BANK_DATA_ENCRYPTION_OPTIONS,
                  ),
                  encryptedAccountName: encryptField(
                    input.accountName!,
                    this.config?.paymentMethodEncryptionKey,
                    BANK_DATA_ENCRYPTION_OPTIONS,
                  ),
                }
              : { accountName: input.accountName ?? null }),
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
      this.assertRetryMatches(existing, amount, input, rail);
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

    if (provider === 'clickpesa') {
      return this.submitClickPesaPayout(created, input, rail, fee);
    }
    // Stamped before the provider call: if this process dies mid-flight, the
    // reconciliation sweeper can tell an attempted submission from one that
    // never started and retry it after the stale window.
    await this.prisma.transaction.update({
      where: { id: created.id },
      data: { providerSubmissionAt: new Date() },
    });
    let payout: AblinerWithdrawalData;
    try {
      payout = await this.abliner.createWithdrawal({
        amount: input.amount,
        method: 'mobile',
        currency: 'TZS',
        recipient: input.phoneNumber!,
        reference: created.reference,
        idempotencyKey: created.id,
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
      metadata?: Prisma.JsonValue | null;
    },
    amount: bigint,
    input: WithdrawalInput,
    rail: 'mobileMoney' | 'bank',
  ): void {
    const matchesMobile =
      rail === 'mobileMoney' &&
      transaction.channel === 'mobileMoney' &&
      Boolean(input.phoneNumber) &&
      transaction.counterparty === input.phoneNumber;
    const metadata =
      typeof transaction.metadata === 'object' &&
      transaction.metadata !== null &&
      !Array.isArray(transaction.metadata)
        ? transaction.metadata
        : {};
    let matchesBank = false;
    if (rail === 'bank') {
      if (!this.config?.paymentMethodEncryptionKey) {
        throw new BadRequestException(
          'Bank payout details cannot be checked because secure storage is not configured.',
        );
      }
      matchesBank =
        transaction.channel === 'bank' &&
        input.bankName === transaction.counterparty &&
        metadata.bankBic === input.bankBic &&
        typeof metadata.encryptedAccountNumber === 'string' &&
        typeof metadata.encryptedAccountName === 'string' &&
        decryptField(
          metadata.encryptedAccountNumber,
          this.config.paymentMethodEncryptionKey,
          BANK_DATA_ENCRYPTION_OPTIONS,
        ) === input.accountNumber &&
        decryptField(
          metadata.encryptedAccountName,
          this.config.paymentMethodEncryptionKey,
          BANK_DATA_ENCRYPTION_OPTIONS,
        ) === input.accountName;
    }
    if (
      transaction.type !== 'withdrawal' ||
      transaction.amount !== amount ||
      !(matchesMobile || matchesBank)
    ) {
      throw new BadRequestException(
        'This withdrawal retry does not match the original request.',
      );
    }
  }

  private async providerForRail(
    rail: 'mobileMoney' | 'bank',
  ): Promise<'abliner' | 'clickpesa'> {
    if (rail === 'bank') {
      await this.paymentProviderSettings?.assertEnabled('clickpesa');
      return 'clickpesa';
    }
    const settings = await this.paymentProviderSettings?.getSettings();
    const provider = settings?.primaryProvider ?? 'abliner';
    await this.paymentProviderSettings?.assertEnabled(provider);
    return provider;
  }

  private clickPesaOrderReference(reference: string): string {
    return reference.replace(/[^a-z0-9]/gi, '').slice(0, 20);
  }

  private normalizeAccountName(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  private async claimClickPesaPayoutSlot(): Promise<boolean> {
    const now = new Date();
    const availableBefore = new Date(now.getTime() - CLICKPESA_PAYOUT_COOLDOWN_MS);
    const claimed = await this.prisma.paymentProviderSettings.updateMany({
      where: {
        id: 'payment-provider-settings',
        OR: [
          { clickpesaLastPayoutAt: null },
          { clickpesaLastPayoutAt: { lte: availableBefore } },
        ],
      },
      data: { clickpesaLastPayoutAt: now },
    });
    return claimed.count === 1;
  }

  private async submitClickPesaPayout(
    transaction: Transaction,
    input: WithdrawalInput,
    rail: 'mobileMoney' | 'bank',
    fee: bigint,
  ): Promise<WithdrawalResult> {
    if (!this.clickpesa) throw new Error('ClickPesa client is not registered');
    if (!(await this.claimClickPesaPayoutSlot())) {
      this.logger.warn(
        `ClickPesa payout ${transaction.reference} is queued behind the provider rate limit`,
      );
      return { transaction: toTransaction(transaction), fee: Number(fee) };
    }

    const submitted = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { providerSubmissionAt: new Date() },
    });
    const orderReference = this.clickPesaOrderReference(transaction.reference);
    const metadata =
      typeof submitted.metadata === 'object' &&
      submitted.metadata !== null &&
      !Array.isArray(submitted.metadata)
        ? submitted.metadata
        : {};
    let payout: ClickPesaPayout;
    try {
      if (rail === 'bank') {
        if (
          !this.config?.paymentMethodEncryptionKey ||
          typeof metadata.encryptedAccountNumber !== 'string' ||
          typeof metadata.encryptedAccountName !== 'string' ||
          typeof metadata.bankBic !== 'string'
        ) {
          throw new Error('Encrypted bank payout details are unavailable.');
        }
        const accountNumber = decryptField(
          metadata.encryptedAccountNumber,
          this.config.paymentMethodEncryptionKey,
          BANK_DATA_ENCRYPTION_OPTIONS,
        );
        const accountName = decryptField(
          metadata.encryptedAccountName,
          this.config.paymentMethodEncryptionKey,
          BANK_DATA_ENCRYPTION_OPTIONS,
        );
        payout = await this.clickpesa.createBankPayout({
          amount: Number(transaction.amount),
          currency: 'TZS',
          orderReference,
          accountNumber,
          accountName,
          bic: metadata.bankBic,
          accountCurrency: 'TZS',
        });
      } else {
        payout = await this.clickpesa.createMobileMoneyPayout({
          amount: Number(transaction.amount),
          currency: 'TZS',
          orderReference,
          phoneNumber: transaction.counterparty,
        });
      }
    } catch (error) {
      if (error instanceof ClickPesaProviderError && error.statusCode === 409) {
        try {
          const existing = await this.clickpesa.getPayout(orderReference);
          if (existing) {
            payout = existing;
          } else {
            throw new ClickPesaProviderError(true, 409);
          }
        } catch (lookupError) {
          if (lookupError instanceof ClickPesaProviderError) {
            if (lookupError.retryable) {
              this.logger.warn(
                `ClickPesa outcome is unknown for withdrawal ${transaction.reference}; keeping its hold for reconciliation`,
              );
              return {
                transaction: toTransaction(submitted),
                fee: Number(fee),
              };
            }
          }
          throw lookupError;
        }
      } else if (error instanceof ClickPesaProviderError && error.retryable) {
        this.logger.warn(
          `ClickPesa outcome is unknown for withdrawal ${transaction.reference}; keeping its hold for reconciliation`,
        );
        return { transaction: toTransaction(submitted), fee: Number(fee) };
      } else {
        await this.settlement.failWithdrawal(submitted);
        throw error;
      }
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        providerRef: payout.id,
        internalReference: orderReference,
        providerStatus: payout.status,
        metadata: {
          ...(metadata as Prisma.InputJsonObject),
          clickpesaOrderReference: orderReference,
        },
      },
    });
    if (!this.matchesClickPesaPayout(updated, payout)) {
      this.logger.warn(
        `ClickPesa payout details do not match ${transaction.reference}; keeping its hold for reconciliation`,
      );
      return { transaction: toTransaction(updated), fee: Number(fee) };
    }
    if (payout.status === 'SUCCESS') {
      await this.settlement.settleWithdrawal(updated);
    } else if (
      payout.status === 'FAILED' ||
      payout.status === 'REFUNDED' ||
      payout.status === 'REVERSED'
    ) {
      await this.settlement.failWithdrawal(updated);
    }
    const current =
      payout.status === 'SUCCESS' ||
      payout.status === 'FAILED' ||
      payout.status === 'REFUNDED' ||
      payout.status === 'REVERSED'
        ? await this.prisma.transaction.findUnique({
            where: { id: transaction.id },
          })
        : updated;
    return {
      transaction: toTransaction(current ?? updated),
      fee: Number(fee),
    };
  }

  private matchesClickPesaPayout(
    transaction: Transaction,
    payout: ClickPesaPayout,
  ): boolean {
    const amount =
      typeof payout.amount === 'number'
        ? Number.isSafeInteger(payout.amount) && payout.amount >= 0
          ? BigInt(payout.amount)
          : null
        : typeof payout.amount === 'string' &&
            /^\d+(?:\.0+)?$/.test(payout.amount)
          ? BigInt(payout.amount.split('.')[0]!)
          : null;
    const channel = payout.channel?.toUpperCase() ?? '';
    const channelMatches =
      transaction.channel === 'bank'
        ? channel.includes('BANK')
        : channel.includes('MOBILE MONEY');
    return (
      payout.currency === transaction.currency &&
      amount === transaction.amount &&
      channelMatches
    );
  }
}
