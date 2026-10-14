import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transaction } from '../src/generated/prisma/client.js';
import type { LimitsService } from '../src/limits/limits.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { ReceiveCodeService } from '../src/qr/receive-code.service.js';
import { WalletService } from '../src/wallet/wallet.service.js';

describe('WalletService', () => {
  it('returns a new provider transaction as pending without reconciling on read', async () => {
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
      createdAt: new Date('2026-10-14T10:00:00.000Z'),
      provider: 'abliner',
    } as unknown as Transaction;

    const service = new WalletService(
      {
        transaction: {
          findFirst: async () => transaction,
        },
      } as unknown as PrismaService,
      {} as LimitsService,
      {} as ReceiveCodeService,
    );

    const result = await service.getTransaction('user-id', transaction.id);

    assert.equal(result.status, 'pending');
    assert.equal(result.reference, transaction.reference);
  });
});
