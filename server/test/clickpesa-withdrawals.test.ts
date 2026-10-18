import 'reflect-metadata';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { WithdrawalInput } from '@mori-pay/contracts';

import type { AblinerClient } from '../src/abliner/abliner.client.js';
import type { AuthService } from '../src/auth/auth.service.js';
import type { ClickPesaClient } from '../src/clickpesa/clickpesa.client.js';
import type { AppConfigService } from '../src/config/app-config.service.js';
import type { Transaction } from '../src/generated/prisma/client.js';
import type { FeesService } from '../src/payments/fees.service.js';
import type { PaymentProviderSettingsService } from '../src/payments/payment-provider-settings.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { SettlementService } from '../src/settlement/settlement.service.js';
import type { LimitsService } from '../src/limits/limits.service.js';
import { WithdrawalsService } from '../src/withdrawals/withdrawals.service.js';
import type { WalletService } from '../src/wallet/wallet.service.js';

const encryptionKey = Buffer.alloc(32, 7).toString('base64');

function transactionRow(data: Record<string, unknown>): Transaction {
  return {
    id: 'withdrawal-1',
    userId: 'user-1',
    reference: 'WDR-ABC123',
    type: 'withdrawal',
    status: 'processing',
    category: 'transfer',
    channel: 'bank',
    direction: 'debit',
    amount: 5_000n,
    fee: 250n,
    feeFlat: 0n,
    feePercentage: 0.05,
    total: 5_250n,
    currency: 'TZS',
    counterparty: 'Example Bank',
    counterpartyDetail: 'Example Bank ••••7890',
    note: null,
    internalReference: null,
    provider: 'clickpesa',
    providerRef: null,
    providerStatus: 'processing',
    providerSubmissionAt: null,
    metadata: data.metadata as Transaction['metadata'],
    idempotencyKey: 'bank-withdrawal-key',
    createdAt: new Date('2026-10-19T10:00:00.000Z'),
    updatedAt: new Date('2026-10-19T10:00:00.000Z'),
    settledAt: null,
  } as Transaction;
}

describe('ClickPesa withdrawals', () => {
  it('uses the administrator-selected ClickPesa provider for mobile payout preview', async () => {
    let recipientNumber = '';
    const service = new WithdrawalsService(
      {} as PrismaService,
      {} as WalletService,
      {
        resolveFeeDetail: async () => ({
          fee: 250n,
          flat: 0n,
          percentage: 0.05,
          ruleId: 'mobile-withdrawal-fee',
        }),
      } as unknown as FeesService,
      {} as AuthService,
      {
        previewWithdrawal: async () => {
          throw new Error('Abliner must not receive this preview');
        },
      } as unknown as AblinerClient,
      {} as SettlementService,
      {} as LimitsService,
      {
        getSettings: async () => ({
          ablinerEnabled: true,
          clickpesaEnabled: true,
          primaryProvider: 'clickpesa',
        }),
        assertEnabled: async () => undefined,
      } as unknown as PaymentProviderSettingsService,
      {
        previewMobileMoneyPayout: async (request: { phoneNumber: string }) => {
          recipientNumber = request.phoneNumber;
          return { recipientName: 'Jane Doe' };
        },
      } as unknown as ClickPesaClient,
    );

    const preview = await service.previewDestination({
      amount: 5_000,
      rail: 'mobileMoney',
      phoneNumber: '255700000001',
    });

    assert.equal(preview.provider, 'clickpesa');
    assert.equal(preview.providerAvailable, true);
    assert.equal(preview.recipientName, 'Jane Doe');
    assert.equal(recipientNumber, '255700000001');
  });

  it('encrypts bank details before persistence and creates the payout with decrypted details', async () => {
    let storedMetadata: Record<string, unknown> | undefined;
    let createRequest: Record<string, unknown> | undefined;
    let bankPreviewCount = 0;
    let savedTransaction = transactionRow({});
    const prisma = {
      transaction: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          storedMetadata = data.metadata as Record<string, unknown>;
          savedTransaction = transactionRow(data);
          return savedTransaction;
        },
        update: async ({
          data,
        }: {
          data: Record<string, unknown>;
        }) => {
          Object.assign(savedTransaction, data);
          return savedTransaction;
        },
      },
      paymentProviderSettings: {
        updateMany: async () => ({ count: 1 }),
      },
      $transaction: async (
        callback: (client: unknown) => Promise<unknown>,
      ) =>
        callback({
          transaction: {
            findUnique: async () => null,
            create: async ({ data }: { data: Record<string, unknown> }) => {
              storedMetadata = data.metadata as Record<string, unknown>;
              savedTransaction = transactionRow(data);
              return savedTransaction;
            },
          },
          notificationPreference: { findUnique: async () => null },
          notification: {
            create: async () => ({ id: 'notification-1' }),
            findMany: async () => [],
            findFirst: async () => null,
          },
          notificationDelivery: { createMany: async () => ({ count: 0 }) },
          device: { findMany: async () => [] },
        }),
    } as unknown as PrismaService;
    const service = new WithdrawalsService(
      prisma,
      {
        loadUserWithWallet: async () => ({
          id: 'user-1',
          tier: 'standard',
          wallet: {
            ledgerAccounts: [{ kind: 'available', balance: 50_000n }],
          },
        }),
      } as unknown as WalletService,
      {
        resolveFeeDetail: async () => ({
          fee: 250n,
          flat: 0n,
          percentage: 0.05,
          ruleId: 'bank-withdrawal-fee',
        }),
      } as unknown as FeesService,
      { verifyPin: async () => undefined } as unknown as AuthService,
      {} as AblinerClient,
      {
        postWithdrawalHold: async () => undefined,
        failWithdrawal: async () => {
          throw new Error('Unexpected provider payout failure');
        },
      } as unknown as SettlementService,
      {
        assertWithinLimitsForUpdate: async () => undefined,
      } as unknown as LimitsService,
      {
        getSettings: async () => ({
          ablinerEnabled: true,
          clickpesaEnabled: true,
          primaryProvider: 'abliner',
        }),
        assertEnabled: async () => undefined,
      } as unknown as PaymentProviderSettingsService,
      {
        listBanks: async () => [{ name: 'Example Bank', bic: 'EXAMTZTZ' }],
        previewBankPayout: async () => {
          bankPreviewCount += 1;
          return { recipientName: 'Jane Doe' };
        },
        createBankPayout: async (request: Record<string, unknown>) => {
          createRequest = request;
          return {
            id: 'provider-payout-1',
            orderReference: request.orderReference,
            status: 'PROCESSING',
            amount: '5000.00',
            currency: 'TZS',
            channel: 'BANK TRANSFER',
          };
        },
      } as unknown as ClickPesaClient,
      { paymentMethodEncryptionKey: encryptionKey } as AppConfigService,
    );
    const input: WithdrawalInput = {
      amount: 5_000,
      rail: 'bank',
      bankBic: 'EXAMTZTZ',
      bankName: 'Example Bank',
      accountNumber: '1234567890',
      accountName: 'Jane Doe',
      pin: '123456',
      idempotencyKey: 'bank-withdrawal-key',
    };

    const result = await service.create('user-1', input);

    assert.equal(bankPreviewCount, 1);
    assert.ok(storedMetadata);
    assert.equal(
      typeof storedMetadata.encryptedAccountNumber,
      'string',
    );
    assert.equal(
      String(storedMetadata.encryptedAccountNumber).includes(input.accountNumber!),
      false,
    );
    assert.equal(storedMetadata.accountNumber, undefined);
    assert.equal(storedMetadata.accountName, undefined);
    assert.equal(
      String(storedMetadata.encryptedAccountName).includes(input.accountName!),
      false,
    );
    assert.equal(createRequest?.accountNumber, input.accountNumber);
    assert.equal(createRequest?.accountName, input.accountName);
    assert.equal(createRequest?.bic, input.bankBic);
    assert.equal(result.transaction.counterparty, 'Example Bank');
    assert.equal(result.transaction.counterpartyDetail, 'Example Bank ••••7890');
    assert.equal(result.transaction.status, 'processing');
  });
});
