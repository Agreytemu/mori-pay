import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AblinerClient } from '../src/abliner/abliner.client.js';
import type { ClickPesaClient } from '../src/clickpesa/clickpesa.client.js';
import type { AppConfigService } from '../src/config/app-config.service.js';
import type { Transaction } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SettlementService } from '../src/settlement/settlement.service.js';
import { ReconciliationService } from '../src/webhooks/reconciliation.service.js';

function setup() {
  const transaction = {
    id: 'transaction-1',
    reference: 'DEP-ABC123',
    internalReference: 'DEPABC123',
    provider: 'clickpesa',
    type: 'deposit',
    channel: 'mobileMoney',
    status: 'pending',
    total: 10_250n,
    currency: 'TZS',
  } as Transaction;
  let settled = 0;
  let failed = 0;
  const service = new ReconciliationService(
    {
      transaction: {
        findFirst: async () => transaction,
      },
    } as unknown as PrismaService,
    {} as AblinerClient,
    {
      settleDeposit: async () => {
        settled += 1;
      },
      failDeposit: async () => {
        failed += 1;
      },
    } as unknown as SettlementService,
    {} as AppConfigService,
  );
  return { service, transaction, counts: () => ({ settled, failed }) };
}

describe('ClickPesa webhook reconciliation', () => {
  it('settles only a matching successful deposit amount and currency', async () => {
    const { service, counts } = setup();
    await service.processClickPesa({
      event: 'PAYMENT RECEIVED',
      data: {
        orderReference: 'DEPABC123',
        status: 'SUCCESS',
        collectedAmount: '10250',
        collectedCurrency: 'TZS',
      },
    });
    assert.deepEqual(counts(), { settled: 1, failed: 0 });
  });

  it('ignores a success notification with a mismatched amount', async () => {
    const { service, counts } = setup();
    await service.processClickPesa({
      event: 'PAYMENT RECEIVED',
      data: {
        orderReference: 'DEPABC123',
        status: 'SUCCESS',
        collectedAmount: '10249',
        collectedCurrency: 'TZS',
      },
    });
    assert.deepEqual(counts(), { settled: 0, failed: 0 });
  });

  it('marks a matching failed event without requiring absent amount fields', async () => {
    const { service, counts } = setup();
    await service.processClickPesa({
      event: 'PAYMENT FAILED',
      data: {
        orderReference: 'DEPABC123',
        status: 'FAILED',
      },
    });
    assert.deepEqual(counts(), { settled: 0, failed: 1 });
  });

  it('settles a matching mobile-money payout webhook', async () => {
    const transaction = {
      id: 'withdrawal-1',
      reference: 'WDR-ABC123',
      internalReference: null,
      provider: 'clickpesa',
      type: 'withdrawal',
      channel: 'mobileMoney',
      status: 'processing',
      amount: 10_000n,
      currency: 'TZS',
    } as Transaction;
    let settled = 0;
    let failed = 0;
    const service = new ReconciliationService(
      {
        transaction: {
          findFirst: async () => transaction,
          update: async () => undefined,
        },
      } as unknown as PrismaService,
      {} as AblinerClient,
      {
        settleWithdrawal: async () => { settled += 1; },
        failWithdrawal: async () => { failed += 1; },
      } as unknown as SettlementService,
      {} as AppConfigService,
      {} as ClickPesaClient,
    );

    await service.processClickPesa({
      event: 'PAYOUT INITIATED',
      data: {
        orderReference: 'WDRABC123',
        status: 'SUCCESS',
        amount: '10000.00',
        currency: 'TZS',
        channel: 'MOBILE MONEY',
      },
    });
    assert.deepEqual({ settled, failed }, { settled: 1, failed: 0 });
  });

  it('does not settle a payout with a mismatched channel or amount', async () => {
    const transaction = {
      id: 'withdrawal-bank',
      reference: 'WDR-ABC124',
      internalReference: 'WDRABC124',
      provider: 'clickpesa',
      type: 'withdrawal',
      channel: 'bank',
      status: 'processing',
      amount: 10_000n,
      currency: 'TZS',
    } as Transaction;
    let settled = 0;
    const service = new ReconciliationService(
      {
        transaction: {
          findFirst: async () => transaction,
          update: async () => undefined,
        },
      } as unknown as PrismaService,
      {} as AblinerClient,
      {
        settleWithdrawal: async () => { settled += 1; },
      } as unknown as SettlementService,
      {} as AppConfigService,
      {} as ClickPesaClient,
    );

    await service.processClickPesa({
      event: 'PAYOUT INITIATED',
      data: {
        orderReference: 'WDRABC124',
        status: 'SUCCESS',
        amount: '10000.00',
        currency: 'TZS',
        channel: 'MOBILE MONEY',
      },
    });
    assert.equal(settled, 0);
  });

  it('returns a refunded payout hold to the wallet only after matching details', async () => {
    const transaction = {
      id: 'withdrawal-reversed',
      reference: 'WDR-ABC125',
      internalReference: 'WDRABC125',
      provider: 'clickpesa',
      type: 'withdrawal',
      channel: 'bank',
      status: 'processing',
      amount: 10_000n,
      currency: 'TZS',
    } as Transaction;
    let failed = 0;
    const service = new ReconciliationService(
      {
        transaction: {
          findFirst: async () => transaction,
          update: async () => undefined,
        },
      } as unknown as PrismaService,
      {} as AblinerClient,
      {
        failWithdrawal: async () => { failed += 1; },
      } as unknown as SettlementService,
      {} as AppConfigService,
      {} as ClickPesaClient,
    );

    await service.processClickPesa({
      event: 'PAYOUT REVERSED',
      data: {
        orderReference: 'WDRABC125',
        status: 'REVERSED',
        amount: '10000.00',
        currency: 'TZS',
        channel: 'BANK TRANSFER',
      },
    });
    assert.equal(failed, 1);
  });
});
