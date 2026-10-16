import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NotFoundException } from '@nestjs/common';

import { MerchantsService } from '../src/merchants/merchants.service.js';

const merchantAccount = {
  id: 'merchant-owned-by-user-1',
  ledgerAccountId: 'merchant-ledger-user-1',
};

const transactionRow = {
  id: 'transaction-1',
  reference: 'PAY-MERCHANT-1',
  status: 'completed',
  type: 'payment',
  category: 'merchant_qr',
  channel: 'wallet',
  amount: 25_000n,
  fee: 0n,
  total: 25_000n,
  currency: 'TZS',
  createdAt: new Date('2026-10-01T09:00:00.000Z'),
  settledAt: new Date('2026-10-01T09:00:03.000Z'),
  ledgerEntries: [{ amount: 25_000n }],
};

function createService(prisma: Record<string, unknown>) {
  return new MerchantsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('merchant portal API data access', () => {
  it('scopes transaction pages and rows to the authenticated merchant ledger', async () => {
    let countWhere: Record<string, unknown> | undefined;
    let rowsWhere: Record<string, unknown> | undefined;
    const service = createService({
      merchantAccount: {
        findFirst: async (args: { where: Record<string, unknown> }) => {
          assert.deepEqual(args.where, { ownerId: 'user-1' });
          return merchantAccount;
        },
      },
      transaction: {
        count: async (args: { where: Record<string, unknown> }) => {
          countWhere = args.where;
          return 1;
        },
        findMany: async (args: { where: Record<string, unknown> }) => {
          rowsWhere = args.where;
          return [transactionRow];
        },
      },
    });

    const result = await service.portalTransactions('user-1', {
      page: 2,
      pageSize: 10,
      search: 'PAY-MERCHANT',
      status: 'completed',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-31T23:59:59.999Z',
    });

    for (const where of [countWhere, rowsWhere]) {
      assert.deepEqual(where?.ledgerEntries, {
        some: {
          ledgerAccountId: 'merchant-ledger-user-1',
          direction: 'credit',
        },
      });
      assert.equal(where?.status, 'completed');
      assert.deepEqual(where?.OR, [
        { id: { contains: 'PAY-MERCHANT', mode: 'insensitive' } },
        { reference: { contains: 'PAY-MERCHANT', mode: 'insensitive' } },
      ]);
    }
    assert.deepEqual(result, {
      items: [
        {
          id: 'transaction-1',
          reference: 'PAY-MERCHANT-1',
          status: 'completed',
          type: 'payment',
          category: 'merchant_qr',
          channel: 'wallet',
          amount: 25_000,
          fee: 0,
          total: 25_000,
          merchantAmount: 25_000,
          currency: 'TZS',
          createdAt: '2026-10-01T09:00:00.000Z',
          settledAt: '2026-10-01T09:00:03.000Z',
        },
      ],
      page: 2,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('does not return a transaction that has no credit entry in the owner merchant ledger', async () => {
    let transactionWhere: Record<string, unknown> | undefined;
    const service = createService({
      merchantAccount: {
        findFirst: async () => merchantAccount,
      },
      transaction: {
        findFirst: async (args: { where: Record<string, unknown> }) => {
          transactionWhere = args.where;
          return null;
        },
      },
    });

    await assert.rejects(
      () => service.portalTransaction('user-1', 'other-merchants-transaction'),
      NotFoundException,
    );
    assert.deepEqual(transactionWhere, {
      id: 'other-merchants-transaction',
      ledgerEntries: {
        some: {
          ledgerAccountId: 'merchant-ledger-user-1',
          direction: 'credit',
        },
      },
    });
  });

  it('labels the balance as a ledger balance and leaves merchant fees unsettled by policy', async () => {
    const application = {
      id: 'application-1',
      businessName: 'Kijani Store',
      category: 'Retail',
      phone: null,
      status: 'approved',
      registrationFeeAmount: null,
      paidAt: null,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      reviewedAt: new Date('2026-09-02T00:00:00.000Z'),
      reviewNote: null,
    };
    const service = createService({
      merchantAccount: {
        findFirst: async (args: { where: Record<string, unknown> }) => {
          assert.deepEqual(args.where, { ownerId: 'user-1' });
          return {
            ...merchantAccount,
            name: 'Kijani Store',
            identifier: 'm-kijani',
            category: 'Retail',
            phone: null,
            status: 'active',
            createdAt: new Date('2026-09-02T00:00:00.000Z'),
            application,
            ledgerAccount: { id: 'merchant-ledger-user-1', balance: 25_000n, currency: 'TZS' },
          };
        },
      },
      transaction: {
        groupBy: async () => [
          { status: 'completed', _count: { _all: 1 }, _sum: { fee: 0n } },
        ],
        findMany: async () => [],
      },
      ledgerEntry: {
        aggregate: async () => ({ _sum: { amount: 25_000n } }),
      },
    });

    const result = await service.portal('user-1', {
      page: 1,
      pageSize: 25,
    });

    assert.equal(result.merchant?.ledgerBalance, 25_000);
    assert.equal(result.report?.grossReceived, 25_000);
    assert.equal(result.report?.netReceived, 25_000);
    assert.equal(result.report?.merchantFees, null);
    assert.equal(result.report?.completedCount, 1);
    assert.equal(result.report?.transactionCount, 1);
  });

  it('exports only ledger-linked fields and neutralizes spreadsheet formulas', async () => {
    let select: Record<string, unknown> | undefined;
    const service = createService({
      merchantAccount: {
        findFirst: async () => merchantAccount,
      },
      transaction: {
        count: async () => 1,
        findMany: async (args: { select: Record<string, unknown> }) => {
          select = args.select;
          return [{
            ...transactionRow,
            reference: '=HYPERLINK("https://example.invalid","open")',
            counterparty: 'Private Customer Name',
            counterpartyDetail: '+255700000000',
            ledgerEntries: [{ amount: 25_000n }],
          }];
        },
      },
    });

    const csv = await service.exportPortalTransactions('user-1', {
      page: 1,
      pageSize: 25,
    });

    assert.ok(csv.includes(`"'=HYPERLINK(""https://example.invalid"",""open"")"`));
    assert.ok(!csv.includes('Private Customer Name'));
    assert.ok(!csv.includes('+255700000000'));
    assert.ok(select);
    assert.equal(select?.counterparty, undefined);
    assert.equal(select?.counterpartyDetail, undefined);
  });
});
