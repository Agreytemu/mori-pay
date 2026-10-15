import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ConflictException } from '@nestjs/common';

import type { LedgerService } from '../src/ledger/ledger.service.js';
import { SYSTEM_LEDGER_ACCOUNTS } from '../src/ledger/ledger.service.js';
import { PaymentsService } from '../src/payments/payments.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { UserWithWallet } from '../src/wallet/wallet.mapper.js';

function user(id: string, phone: string, fullName: string): UserWithWallet {
  return {
    id,
    phone,
    fullName,
    firstName: fullName.split(' ')[0],
    wallet: {
      id: `wallet-${id}`,
      ledgerAccounts: [{ id: `account-${id}`, kind: 'available' }],
    },
  } as unknown as UserWithWallet;
}

function transactionRow(overrides: Record<string, unknown>) {
  return {
    id: 'txn-1',
    userId: 'sender',
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
    counterparty: 'Bob',
    counterpartyDetail: '255700000002',
    note: null,
    internalReference: null,
    provider: null,
    providerRef: null,
    providerStatus: null,
    metadata: { recipientUserId: 'recipient' },
    idempotencyKey: 'key-1',
    createdAt: new Date('2026-10-15T10:00:00.000Z'),
    updatedAt: new Date('2026-10-15T10:00:00.000Z'),
    settledAt: new Date('2026-10-15T10:00:00.000Z'),
    ...overrides,
  };
}

const ledger = {
  post: async () => undefined,
  getSystemAccount: async () => ({ id: 'system-account' }),
} as unknown as LedgerService;

function client(existing: unknown) {
  return {
    transaction: {
      findUnique: async () => existing,
      create: async () => transactionRow({}),
    },
    notificationPreference: { findUnique: async () => null },
    notification: { create: async () => undefined },
  } as unknown;
}

describe('PaymentsService idempotency', () => {
  it('returns the original transaction when the same key and payload are replayed', async () => {
    const service = new PaymentsService({} as PrismaService, ledger);
    const sender = user('sender', '255700000001', 'Alice Smith');
    const recipient = user('recipient', '255700000002', 'Bob Jones');
    const existing = transactionRow({});

    const result = await service.transferToUser(
      {
        from: sender,
        to: recipient,
        amount: 5_000n,
        fee: 0n,
        type: 'send',
        category: 'person',
        idempotencyKey: 'key-1',
      },
      client(existing) as never,
    );

    assert.equal(result.reference, 'TRF-1');
  });

  it('rejects reusing a key with a different amount', async () => {
    const service = new PaymentsService({} as PrismaService, ledger);
    const sender = user('sender', '255700000001', 'Alice Smith');
    const recipient = user('recipient', '255700000002', 'Bob Jones');

    await assert.rejects(
      () =>
        service.transferToUser(
          {
            from: sender,
            to: recipient,
            amount: 9_000n,
            fee: 0n,
            type: 'send',
            category: 'person',
            idempotencyKey: 'key-1',
          },
          client(transactionRow({})) as never,
        ),
      ConflictException,
    );
  });

  it('rejects reusing a key for a different recipient', async () => {
    const service = new PaymentsService({} as PrismaService, ledger);
    const sender = user('sender', '255700000001', 'Alice Smith');
    const other = user('other', '255700000003', 'Carol White');

    await assert.rejects(
      () =>
        service.transferToUser(
          {
            from: sender,
            to: other,
            amount: 5_000n,
            fee: 0n,
            type: 'send',
            category: 'person',
            idempotencyKey: 'key-1',
          },
          client(transactionRow({})) as never,
        ),
      ConflictException,
    );
  });

  it('rejects a money-request key collision with an unrelated transfer', async () => {
    const service = new PaymentsService({} as PrismaService, ledger);
    const payer = user('sender', '255700000001', 'Alice Smith');
    const requester = user('requester', '255700000004', 'Dana Black');

    // Existing row is an unrelated transfer, not the money-request payment.
    await assert.rejects(
      () =>
        service.transferToUser(
          {
            from: payer,
            to: requester,
            amount: 5_000n,
            fee: 0n,
            type: 'send',
            category: 'person',
            idempotencyKey: 'key-1',
            metadata: { moneyRequestId: 'request-42' },
          },
          client(transactionRow({})) as never,
        ),
      ConflictException,
    );
  });

  it('returns the original payment when a merchant scope key is replayed', async () => {
    const service = new PaymentsService({} as PrismaService, ledger);
    const payer = user('sender', '255700000001', 'Alice Smith');
    const existing = transactionRow({
      type: 'payment',
      category: 'merchant_qr',
      counterparty: 'Shop',
      metadata: { merchantAccountId: 'm-1', merchantQrCodeId: 'qr-1' },
    });

    const result = await service.paySystem(
      {
        from: payer,
        system: SYSTEM_LEDGER_ACCOUNTS.merchant,
        amount: 5_000n,
        fee: 0n,
        type: 'payment',
        category: 'merchant_qr',
        counterparty: 'Shop',
        idempotencyKey: 'key-1',
        metadata: { merchantAccountId: 'm-1', merchantQrCodeId: 'qr-1' },
      },
      client(existing) as never,
    );

    assert.equal(result.amount, 5_000);
  });

  it('rejects a merchant payment replayed against a different QR code', async () => {
    const service = new PaymentsService({} as PrismaService, ledger);
    const payer = user('sender', '255700000001', 'Alice Smith');
    const existing = transactionRow({
      type: 'payment',
      category: 'merchant_qr',
      counterparty: 'Shop',
      metadata: { merchantAccountId: 'm-1', merchantQrCodeId: 'qr-1' },
    });

    await assert.rejects(
      () =>
        service.paySystem(
          {
            from: payer,
            system: SYSTEM_LEDGER_ACCOUNTS.merchant,
            amount: 5_000n,
            fee: 0n,
            type: 'payment',
            category: 'merchant_qr',
            counterparty: 'Shop',
            idempotencyKey: 'key-1',
            metadata: { merchantAccountId: 'm-1', merchantQrCodeId: 'qr-2' },
          },
          client(existing) as never,
        ),
      ConflictException,
    );
  });
});

