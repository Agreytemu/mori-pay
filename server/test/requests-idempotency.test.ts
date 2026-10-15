import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ConflictException } from '@nestjs/common';

import { RequestsService } from '../src/requests/requests.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { WalletService } from '../src/wallet/wallet.service.js';

const requestRow = {
  id: 'request-42',
  requesterId: 'requester',
  payerPhone: '255700000002',
  amount: 5_000n,
  note: null,
  status: 'paid',
  reference: 'REQ-1',
  createdAt: new Date('2026-10-15T10:00:00.000Z'),
  updatedAt: new Date('2026-10-15T10:00:00.000Z'),
  expiresAt: null,
};

function transactionRow(metadata: Record<string, unknown>) {
  return {
    id: 'txn-1',
    userId: 'payer',
    reference: 'TRF-1',
    type: 'send',
    status: 'completed',
    category: 'person',
    channel: 'wallet',
    direction: 'debit',
    amount: 5_000n,
    fee: 0n,
    feeFlat: 0n,
    feePercentage: 0,
    total: 5_000n,
    currency: 'TZS',
    counterparty: 'Dana Black',
    counterpartyDetail: '255700000004',
    note: null,
    internalReference: null,
    provider: null,
    providerRef: null,
    providerStatus: null,
    metadata,
    idempotencyKey: 'key-1',
    createdAt: new Date('2026-10-15T10:00:00.000Z'),
    updatedAt: new Date('2026-10-15T10:00:00.000Z'),
    settledAt: new Date('2026-10-15T10:00:00.000Z'),
  };
}

function serviceWith(existing: unknown) {
  let moneyRequestUpdated = false;
  const prisma = {
    moneyRequest: {
      findUnique: async () => requestRow,
      findUniqueOrThrow: async () => requestRow,
      updateMany: async () => {
        moneyRequestUpdated = true;
        return { count: 1 };
      },
    },
    transaction: {
      findUnique: async () => existing,
    },
    user: {
      findUniqueOrThrow: async () => ({ fullName: 'Dana Black' }),
    },
  } as unknown as PrismaService;
  const wallet = {
    loadUserWithWallet: async () => ({
      id: 'payer',
      phone: '255700000002',
      fullName: 'Alice Smith',
      tier: 'Standard',
    }),
  } as unknown as WalletService;
  const service = new RequestsService(
    prisma,
    wallet,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, wasUpdated: () => moneyRequestUpdated };
}

describe('RequestsService idempotency', () => {
  it('replays the original transfer for the same request instead of failing', async () => {
    const { service, wasUpdated } = serviceWith(
      transactionRow({ recipientUserId: 'requester', moneyRequestId: 'request-42' }),
    );

    const result = await service.pay('payer', 'request-42', {
      pin: '123456',
      idempotencyKey: 'key-1',
    });

    assert.equal(result.transaction.reference, 'TRF-1');
    assert.equal(result.fee, 0);
    assert.equal(wasUpdated(), false);
  });

  it('rejects a key already used for an unrelated transaction', async () => {
    const { service, wasUpdated } = serviceWith(
      transactionRow({ recipientUserId: 'someone-else' }),
    );

    await assert.rejects(
      () =>
        service.pay('payer', 'request-42', {
          pin: '123456',
          idempotencyKey: 'key-1',
        }),
      ConflictException,
    );
    assert.equal(wasUpdated(), false);
  });

  it('rejects a key used for a different money request', async () => {
    const { service } = serviceWith(
      transactionRow({ recipientUserId: 'requester', moneyRequestId: 'other-request' }),
    );

    await assert.rejects(
      () =>
        service.pay('payer', 'request-42', {
          pin: '123456',
          idempotencyKey: 'key-1',
        }),
      ConflictException,
    );
  });
});
