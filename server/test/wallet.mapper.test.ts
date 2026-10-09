import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  toAuthUser,
  toTransaction,
  toWalletAccount,
  type UserWithWallet,
} from '../src/wallet/wallet.mapper.js';
import type { Transaction } from '../src/generated/prisma/client.js';

function fakeUser(): UserWithWallet {
  return {
    id: 'usr_1',
    phone: '255712345678',
    fullName: 'Amina Juma',
    firstName: 'Amina',
    email: null,
    memberId: 'MP12345678',
    tier: 'tier1',
    kycLevel: 1,
    status: 'active',
    nationalId: '199001011234',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    wallet: {
      id: 'wal_1',
      userId: 'usr_1',
      currency: 'TZS',
      accountNumber: '0123456789',
      status: 'active',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ledgerAccounts: [
        {
          id: 'acc_1',
          walletId: 'wal_1',
          kind: 'available',
          currency: 'TZS',
          balance: 7500n,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'acc_2',
          walletId: 'wal_1',
          kind: 'pending',
          currency: 'TZS',
          balance: 2500n,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
  } as unknown as UserWithWallet;
}

describe('wallet mapper', () => {
  it('maps the authenticated user', () => {
    const user = toAuthUser(fakeUser());
    assert.equal(user.id, 'usr_1');
    assert.equal(user.phoneNumber, '255712345678');
    assert.equal(user.currency, 'TZS');
  });

  it('splits available and pending balances', () => {
    const wallet = toWalletAccount(fakeUser());
    assert.equal(wallet.balance.available, 7500);
    assert.equal(wallet.balance.pending, 2500);
    assert.equal(wallet.accountNumber, '0123456789');
    assert.equal(wallet.nationalId, '****1234');
  });

  it('maps a transaction to the public shape', () => {
    const transaction = {
      id: 'txn_1',
      reference: 'REF1',
      type: 'send',
      status: 'completed',
      category: 'person',
      channel: 'wallet',
      direction: 'debit',
      amount: 3000n,
      fee: 0n,
      total: 3000n,
      currency: 'TZS',
      counterparty: 'Ali',
      counterpartyDetail: null,
      note: null,
      createdAt: new Date('2026-02-01T10:00:00.000Z'),
    } as unknown as Transaction;

    const dto = toTransaction(transaction);
    assert.equal(dto.amount, 3000);
    assert.equal(dto.direction, 'debit');
    assert.equal(dto.createdAt, '2026-02-01T10:00:00.000Z');
    assert.equal(dto.counterpartyDetail, undefined);
  });
});
