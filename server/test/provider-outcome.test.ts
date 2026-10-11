import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TopupMobileMoneyInput, WithdrawalInput } from '@mori-pay/contracts';

import { pendingDepositDataFixture } from './fixtures/abliner-contract.fixtures.js';
import {
  AblinerProviderError,
  type AblinerClient,
} from '../src/abliner/abliner.client.js';
import type { AuthService } from '../src/auth/auth.service.js';
import type { AppConfigService } from '../src/config/app-config.service.js';
import type { FeesService } from '../src/payments/fees.service.js';
import type { LimitsService } from '../src/limits/limits.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { SettlementService } from '../src/settlement/settlement.service.js';
import type { WalletService } from '../src/wallet/wallet.service.js';
import { TopUpsService } from '../src/topups/topups.service.js';
import { WithdrawalsService } from '../src/withdrawals/withdrawals.service.js';

function notificationTransaction(
  createdTransaction: Record<string, unknown> = {
    id: 'transaction-id',
    userId: 'user-id',
    reference: 'DEP-REFERENCE',
    direction: 'credit',
    amount: 5_000n,
    counterparty: '255700000001',
  },
) {
  return {
    notificationPreference: {
      findUnique: async () => null,
    },
    notification: {
      create: async () => undefined,
    },
    transaction: {
      create: async () => createdTransaction,
    },
  };
}

const mobileTopup: TopupMobileMoneyInput = {
  amount: 5_000,
  mobileNumber: '255700000001',
  network: 'Mpesa',
};

describe('provider request outcomes', () => {
  it('charges the disclosed card top-up total while crediting the selected amount', async () => {
    let providerAmount = 0;
    let createdData: Record<string, unknown> | undefined;
    const transactionRow = {
      id: 'card-transaction-id',
      userId: 'user-id',
      reference: 'DEP-CARD-REFERENCE',
      type: 'deposit',
      status: 'pending',
      category: 'topUp',
      channel: 'card',
      direction: 'credit',
      amount: 10_000n,
      fee: 450n,
      feeFlat: 0n,
      feePercentage: 0.045,
      total: 10_450n,
      currency: 'TZS',
      counterparty: 'Card payment',
      counterpartyDetail: null,
      note: null,
      provider: 'abliner',
      providerRef: null,
      createdAt: new Date('2026-10-11T10:00:00.000Z'),
    };
    const service = new TopUpsService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            notificationPreference: { findUnique: async () => null },
            notification: { create: async () => undefined },
            transaction: {
              create: async ({ data }: { data: Record<string, unknown> }) => {
                createdData = data;
                return { ...transactionRow, ...data };
              },
            },
          }),
        transaction: {
          update: async ({ data }: { data: Record<string, unknown> }) => ({
            ...transactionRow,
            ...data,
          }),
        },
      } as unknown as PrismaService,
      {
        createDeposit: async ({ amount }: { amount: number }) => {
          providerAmount = amount;
          return {
            id: 'provider-card-deposit',
            type: 'deposit',
            status: 'pending',
            amount,
            currency: 'TZS',
            method: 'card',
            payment_url: 'https://checkout.example.com/session',
            reference: 'ABL-CARD-REFERENCE',
            customer_reference: 'DEP-CARD-REFERENCE',
          };
        },
      } as unknown as AblinerClient,
      {
        abliner: { callbackUrl: 'https://pay.example.com/webhooks' },
      } as unknown as AppConfigService,
      {
        resolveFeeDetail: async () => ({
          fee: 450n,
          flat: 0n,
          percentage: 0.045,
          ruleId: 'card-fee',
        }),
      } as unknown as FeesService,
    );

    const result = await service.initiateCard('user-id', { amount: 10_000 });

    assert.equal(createdData?.amount, 10_000n);
    assert.equal(createdData?.fee, 450n);
    assert.equal(createdData?.total, 10_450n);
    assert.equal(providerAmount, 10_450);
    assert.equal(result.transaction.amount, 10_000);
    assert.equal(result.transaction.fee, 450);
  });

  it('keeps a deposit pending when the provider outcome is unknown', async () => {
    let transactionUpdated = false;
    const prisma = {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(notificationTransaction()),
      transaction: {
        update: async () => {
          transactionUpdated = true;
        },
      },
    };
    const service = new TopUpsService(
      prisma as unknown as PrismaService,
      {
        createDeposit: async () => {
          throw new AblinerProviderError(undefined, true, 'connection timed out');
        },
      } as unknown as AblinerClient,
      {
        abliner: { callbackUrl: 'https://pay.example.com/webhooks' },
      } as unknown as AppConfigService,
      {
        resolveFeeDetail: async () => ({
          fee: 0n,
          flat: 0n,
          percentage: 0,
          ruleId: null,
        }),
      } as unknown as FeesService,
    );

    await assert.rejects(
      () => service.initiateMobileMoney('user-id', mobileTopup),
      AblinerProviderError,
    );
    assert.equal(transactionUpdated, false);
  });

  it('marks a deposit failed for a definitive provider rejection', async () => {
    let transactionUpdated = false;
    const prisma = {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(notificationTransaction()),
      transaction: {
        update: async () => {
          transactionUpdated = true;
        },
      },
    };
    const service = new TopUpsService(
      prisma as unknown as PrismaService,
      {
        createDeposit: async () => {
          throw new AblinerProviderError('amount_out_of_range');
        },
      } as unknown as AblinerClient,
      {
        abliner: { callbackUrl: 'https://pay.example.com/webhooks' },
      } as unknown as AppConfigService,
      {
        resolveFeeDetail: async () => ({
          fee: 0n,
          flat: 0n,
          percentage: 0,
          ruleId: null,
        }),
      } as unknown as FeesService,
    );

    await assert.rejects(
      () => service.initiateMobileMoney('user-id', mobileTopup),
      AblinerProviderError,
    );
    assert.equal(transactionUpdated, true);
  });

  it('does not mark a created deposit failed if its provider reference cannot be saved', async () => {
    let updateCalls = 0;
    const service = new TopUpsService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback(notificationTransaction()),
        transaction: {
          update: async () => {
            updateCalls += 1;
            throw new Error('database temporarily unavailable');
          },
        },
      } as unknown as PrismaService,
      {
        createDeposit: async () => pendingDepositDataFixture,
      } as unknown as AblinerClient,
      {
        abliner: { callbackUrl: 'https://pay.example.com/webhooks' },
      } as unknown as AppConfigService,
      {
        resolveFeeDetail: async () => ({
          fee: 0n,
          flat: 0n,
          percentage: 0,
          ruleId: null,
        }),
      } as unknown as FeesService,
    );

    await assert.rejects(
      () => service.initiateMobileMoney('user-id', mobileTopup),
      /database temporarily unavailable/,
    );
    assert.equal(updateCalls, 1);
  });

  it('keeps a withdrawal hold when the provider outcome is unknown', async () => {
    let failed = false;
    const transaction = {
      id: 'withdrawal-id',
      userId: 'user-id',
      reference: 'WDR-REFERENCE',
      direction: 'debit',
      amount: 5_000n,
      fee: 0n,
      counterparty: '255700000001',
      providerRef: null,
      status: 'processing',
    };
    const service = new WithdrawalsService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback(notificationTransaction(transaction)),
      } as unknown as PrismaService,
      {
        loadUserWithWallet: async () => ({
          id: 'user-id',
          tier: 'standard',
          wallet: {
            ledgerAccounts: [{ kind: 'available', balance: 50_000n }],
          },
        }),
      } as unknown as WalletService,
      {
        resolveFeeDetail: async () => ({
          fee: 0n,
          flat: 0n,
          percentage: 0,
          ruleId: null,
        }),
      } as unknown as FeesService,
      {
        verifyPin: async () => undefined,
      } as unknown as AuthService,
      {
        previewWithdrawal: async () => ({
          amount_tzs: 5_000,
          fee_tzs: 0,
          total_debited_tzs: 5_000,
        }),
        createWithdrawal: async () => {
          throw new AblinerProviderError(undefined, true, 'connection timed out');
        },
      } as unknown as AblinerClient,
      {
        postWithdrawalHold: async () => undefined,
        failWithdrawal: async () => {
          failed = true;
        },
      } as unknown as SettlementService,
      {
        assertWithinLimits: async () => undefined,
      } as unknown as LimitsService,
    );

    const withdrawal: WithdrawalInput = {
      amount: 5_000,
      phoneNumber: '255700000001',
      network: 'Mpesa',
      pin: '123456',
    };

    await assert.rejects(
      () => service.create('user-id', withdrawal),
      AblinerProviderError,
    );
    assert.equal(failed, false);
  });

  it('does not submit a second payout when retrying an existing idempotent withdrawal', async () => {
    let providerCalls = 0;
    let holdCalls = 0;
    const existing = {
      id: 'withdrawal-id',
      userId: 'user-id',
      reference: 'WDR-REFERENCE',
      type: 'withdrawal',
      status: 'processing',
      category: 'transfer',
      channel: 'mobileMoney',
      direction: 'debit',
      amount: 5_000n,
      currency: 'TZS',
      fee: 250n,
      feeFlat: 250n,
      feePercentage: 0,
      counterparty: '255700000001',
      counterpartyDetail: 'M-Pesa',
      note: null,
      providerRef: null,
      createdAt: new Date('2026-10-11T10:00:00.000Z'),
    };
    const service = new WithdrawalsService(
      {
        transaction: {
          findUnique: async () => existing,
        },
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            transaction: {
              findUnique: async () => existing,
            },
          }),
      } as unknown as PrismaService,
      {
        loadUserWithWallet: async () => ({
          id: 'user-id',
          tier: 'standard',
          wallet: {
            ledgerAccounts: [{ kind: 'available', balance: 50_000n }],
          },
        }),
      } as unknown as WalletService,
      {
        resolveFeeDetail: async () => ({
          fee: 0n,
          flat: 0n,
          percentage: 0,
          ruleId: null,
        }),
      } as unknown as FeesService,
      {
        verifyPin: async () => undefined,
      } as unknown as AuthService,
      {
        previewWithdrawal: async () => ({
          amount_tzs: 5_000,
          fee_tzs: 0,
          total_debited_tzs: 5_000,
        }),
        createWithdrawal: async () => {
          providerCalls += 1;
          return {
            id: 'provider-withdrawal-id',
            status: 'processing',
            amount: 5_000,
            currency: 'TZS',
          };
        },
      } as unknown as AblinerClient,
      {
        postWithdrawalHold: async () => {
          holdCalls += 1;
        },
      } as unknown as SettlementService,
      {
        assertWithinLimits: async () => undefined,
      } as unknown as LimitsService,
    );

    const withdrawal: WithdrawalInput = {
      amount: 5_000,
      phoneNumber: '255700000001',
      network: 'Mpesa',
      pin: '123456',
      idempotencyKey: 'withdrawal-retry-key',
    };

    const result = await service.create('user-id', withdrawal);

    assert.equal(result.transaction.status, 'processing');
    assert.equal(result.fee, 250);
    assert.equal(providerCalls, 0);
    assert.equal(holdCalls, 0);
  });

  it('does not release a withdrawal hold if the provider reference cannot be saved', async () => {
    let failed = false;
    const transaction = {
      id: 'withdrawal-id',
      userId: 'user-id',
      reference: 'WDR-REFERENCE',
      direction: 'debit',
      amount: 5_000n,
      fee: 0n,
      counterparty: '255700000001',
      providerRef: null,
      status: 'processing',
    };
    const service = new WithdrawalsService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback(notificationTransaction(transaction)),
        transaction: {
          update: async () => {
            throw new Error('database temporarily unavailable');
          },
        },
      } as unknown as PrismaService,
      {
        loadUserWithWallet: async () => ({
          id: 'user-id',
          tier: 'standard',
          wallet: {
            ledgerAccounts: [{ kind: 'available', balance: 50_000n }],
          },
        }),
      } as unknown as WalletService,
      {
        resolveFeeDetail: async () => ({
          fee: 0n,
          flat: 0n,
          percentage: 0,
          ruleId: null,
        }),
      } as unknown as FeesService,
      {
        verifyPin: async () => undefined,
      } as unknown as AuthService,
      {
        previewWithdrawal: async () => ({
          amount_tzs: 5_000,
          fee_tzs: 0,
          total_debited_tzs: 5_000,
        }),
        createWithdrawal: async () => ({
          id: 'provider-withdrawal-id',
          status: 'processing',
          amount: 5_000,
          currency: 'TZS',
        }),
      } as unknown as AblinerClient,
      {
        postWithdrawalHold: async () => undefined,
        failWithdrawal: async () => {
          failed = true;
        },
      } as unknown as SettlementService,
      {
        assertWithinLimits: async () => undefined,
      } as unknown as LimitsService,
    );

    const withdrawal: WithdrawalInput = {
      amount: 5_000,
      phoneNumber: '255700000001',
      network: 'Mpesa',
      pin: '123456',
    };

    await assert.rejects(
      () => service.create('user-id', withdrawal),
      /database temporarily unavailable/,
    );
    assert.equal(failed, false);
  });
});
