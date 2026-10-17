import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transaction } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { LedgerService } from '../src/ledger/ledger.service.js';
import { SettlementService } from '../src/settlement/settlement.service.js';

describe('SettlementService', () => {
  it('credits card top-up fees separately from the wallet amount', async () => {
    let posting:
      | {
          reference: string;
          legs: Array<{
            ledgerAccountId: string;
            direction: string;
            amount: bigint;
          }>;
        }
      | undefined;
    const prisma = {
      $transaction: async (callback: (client: unknown) => Promise<unknown>) =>
        callback({
          transaction: {
            updateMany: async () => ({ count: 1 }),
          },
          wallet: {
            findUnique: async () => ({
              ledgerAccounts: [{ id: 'wallet-available', kind: 'available' }],
            }),
          },
          notification: {
            findMany: async () => [],
          },
          notificationDelivery: {
            createMany: async () => ({ count: 0 }),
          },
          notificationPreference: {
            findUnique: async () => null,
          },
          device: {
            findMany: async () => [],
          },
        }),
    };
    const ledger = {
      getSystemAccount: async (kind: string) => ({ id: `system-${kind}` }),
      post: async (input: typeof posting) => {
        posting = input;
      },
    };
    const service = new SettlementService(
      prisma as unknown as PrismaService,
      ledger as unknown as LedgerService,
    );
    const transaction = {
      id: 'card-deposit-id',
      userId: 'user-id',
      reference: 'DEP-REF',
      type: 'deposit',
      status: 'pending',
      amount: 10_000n,
      fee: 450n,
      total: 10_450n,
      provider: 'abliner',
    } as Transaction;

    await service.settleDeposit(transaction);

    assert.deepEqual(posting?.legs, [
      {
        ledgerAccountId: 'system-external',
        direction: 'debit',
        amount: 10_450n,
        allowNegative: true,
      },
      {
        ledgerAccountId: 'wallet-available',
        direction: 'credit',
        amount: 10_000n,
      },
      {
        ledgerAccountId: 'system-fees',
        direction: 'credit',
        amount: 450n,
      },
    ]);
  });
});
