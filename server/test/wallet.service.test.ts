import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transaction } from '../src/generated/prisma/client.js';
import type { LimitsService } from '../src/limits/limits.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { ReceiveCodeService } from '../src/qr/receive-code.service.js';
import type { ReconciliationService } from '../src/webhooks/reconciliation.service.js';
import { WalletService } from '../src/wallet/wallet.service.js';

describe('WalletService', () => {
  it('does not reconcile a new provider transaction while the payment prompt is active', async () => {
    let reconciliations = 0;
    const transaction = {
      id: 'transaction-id',
      reference: 'DEP-REFERENCE',
      type: 'deposit',
      status: 'pending',
      category: 'topUp',
      channel: 'mobileMoney',
      amount: 5_000n,
      currency: 'TZS',
      fee: 0n,
      feeFlat: 0n,
      feePercentage: 0,
      total: 5_000n,
      counterparty: '255700000001',
      counterpartyDetail: 'M-Pesa',
      note: null,
      direction: 'credit',
      createdAt: new Date(),
      provider: 'abliner',
    } as unknown as Transaction;

    const service = new WalletService(
      {
        transaction: {
          findFirst: async () => transaction,
        },
      } as unknown as PrismaService,
      {
        reconcile: async () => {
          reconciliations += 1;
        },
      } as unknown as ReconciliationService,
      {} as LimitsService,
      {} as ReceiveCodeService,
    );

    const result = await service.getTransaction('user-id', transaction.id);

    assert.equal(result.status, 'pending');
    assert.equal(result.reference, transaction.reference);
    assert.equal(reconciliations, 0);
  });

  it('checks Abliner after the prompt grace period and returns its final status', async () => {
    const transaction = {
      id: 'transaction-id',
      reference: 'DEP-REFERENCE',
      type: 'deposit',
      status: 'pending',
      category: 'topUp',
      channel: 'mobileMoney',
      amount: 5_000n,
      currency: 'TZS',
      fee: 0n,
      feeFlat: 0n,
      feePercentage: 0,
      total: 5_000n,
      counterparty: '255700000001',
      counterpartyDetail: 'M-Pesa',
      note: null,
      direction: 'credit',
      createdAt: new Date(Date.now() - 31_000),
      provider: 'abliner',
    } as unknown as Transaction;
    let persisted = transaction;
    const service = new WalletService(
      {
        transaction: {
          findFirst: async () => transaction,
          findUnique: async () => persisted,
        },
      } as unknown as PrismaService,
      {
        reconcile: async () => {
          persisted = { ...transaction, status: 'cancelled' } as Transaction;
        },
      } as unknown as ReconciliationService,
      {} as LimitsService,
      {} as ReceiveCodeService,
    );

    const result = await service.getTransaction('user-id', transaction.id);

    assert.equal(result.status, 'cancelled');
  });
});
