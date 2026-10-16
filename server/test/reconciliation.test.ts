import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  AblinerTransaction,
  AblinerWebhookInput,
} from '@mori-pay/contracts';

import {
  AblinerClient,
  AblinerProviderError,
} from '../src/abliner/abliner.client.js';
import type { AppConfigService } from '../src/config/app-config.service.js';
import type { Transaction } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { SettlementService } from '../src/settlement/settlement.service.js';
import { ReconciliationService } from '../src/webhooks/reconciliation.service.js';
import { ReconciliationSweeper } from '../src/webhooks/reconciliation.sweeper.js';

const providerTransaction: AblinerTransaction = {
  id: 'abl-tx-1',
  type: 'deposit',
  amount: 5_000,
  currency: 'TZS',
  status: 'completed',
  reference: 'ABL-REF-1',
  customer_reference: 'DEP-REF-1',
  created_at: '2026-10-11T10:00:00.000Z',
};

const pendingDeposit = {
  id: 'transaction-id-1',
  reference: 'DEP-REF-1',
  type: 'deposit',
  status: 'pending',
  provider: 'abliner',
  currency: 'TZS',
  channel: 'mobileMoney',
  amount: 5_000n,
  fee: 0n,
  total: 5_000n,
  internalReference: null,
  providerRef: null,
} as unknown as Transaction;

const pendingWithdrawal = {
  id: 'withdrawal-id-1',
  reference: 'WDR-REF-1',
  type: 'withdrawal',
  status: 'processing',
  provider: 'abliner',
  amount: 5_000n,
  fee: 250n,
  total: 5_250n,
  internalReference: null,
  providerRef: null,
} as unknown as Transaction;

const reconciliationConfig = {
  reconciliation: { enabled: true, intervalSeconds: 120, staleSeconds: 180 },
} as unknown as AppConfigService;

type TransactionLookup = {
  id?: string;
  customerReference?: string;
  idempotencyKey?: string;
};

const webhook: AblinerWebhookInput = {
  id: 'event-1',
  event: 'transaction.completed',
  data: {
    id: 'abl-tx-1',
    type: 'deposit',
    amount: 5_000,
    currency: 'TZS',
    status: 'completed',
    reference: 'ABL-REF-1',
    customer_reference: 'DEP-REF-1',
  },
};

describe('ReconciliationService', () => {
  it('recovers a deposit by idempotency key when provider references were not saved', async () => {
    const queries: Array<{
      id?: string;
      customerReference?: string;
      idempotencyKey?: string;
    }> = [];
    const settled: Transaction[] = [];
    const service = new ReconciliationService(
      {} as PrismaService,
      {
        findTransaction: async (query: TransactionLookup) => {
          queries.push(query);
          return query.idempotencyKey
            ? { ...providerTransaction, idempotency_key: query.idempotencyKey }
            : null;
        },
      } as unknown as AblinerClient,
      {
        settleDeposit: async (transaction: Transaction) => {
          settled.push(transaction);
        },
      } as unknown as SettlementService,
      reconciliationConfig,
    );

    await service.reconcile(pendingDeposit);

    assert.deepEqual(queries, [
      { customerReference: 'DEP-REF-1' },
      { idempotencyKey: 'transaction-id-1' },
    ]);
    assert.deepEqual(settled, [pendingDeposit]);
  });

  it('recovers a withdrawal by customer reference when provider references were not saved', async () => {
    const queries: TransactionLookup[] = [];
    let settled: Transaction | undefined;
    const completedWithdrawal: AblinerTransaction = {
      ...providerTransaction,
      id: 'abl-withdrawal-1',
      type: 'withdrawal',
      customer_reference: 'WDR-REF-1',
    };
    const service = new ReconciliationService(
      {} as PrismaService,
      {
        findTransaction: async (query: TransactionLookup) => {
          queries.push(query);
          return completedWithdrawal;
        },
      } as unknown as AblinerClient,
      {
        settleWithdrawal: async (transaction: Transaction) => {
          settled = transaction;
        },
      } as unknown as SettlementService,
      reconciliationConfig,
    );

    await service.reconcile(pendingWithdrawal);

    assert.deepEqual(queries, [{ customerReference: 'WDR-REF-1' }]);
    assert.equal(settled, pendingWithdrawal);
  });

  it('settles a signed webhook by customer reference without a second provider lookup', async () => {
    let lookup: { provider: string; OR: unknown[] } | undefined;
    const settled: Transaction[] = [];
    const service = new ReconciliationService(
      {
        transaction: {
          findFirst: async ({ where }: { where: { provider: string; OR: unknown[] } }) => {
            lookup = where;
            return pendingDeposit;
          },
        },
      } as unknown as PrismaService,
      {
        findTransaction: async () => {
          assert.fail('signed webhooks should not require another provider lookup');
        },
      } as unknown as AblinerClient,
      {
        settleDeposit: async (transaction: Transaction) => {
          settled.push(transaction);
        },
      } as unknown as SettlementService,
      reconciliationConfig,
    );

    await service.process(webhook);

    assert.equal(lookup?.provider, 'abliner');
    assert.ok(
      lookup?.OR.some(
        (condition) =>
          typeof condition === 'object' &&
          condition !== null &&
          'reference' in condition &&
          condition.reference === 'DEP-REF-1',
      ),
    );
    assert.deepEqual(settled, [pendingDeposit]);
  });

  it('marks a signed failed webhook as failed immediately', async () => {
    let failed: Transaction | undefined;
    const service = new ReconciliationService(
      {
        transaction: {
          findFirst: async () => pendingDeposit,
        },
      } as unknown as PrismaService,
      {} as AblinerClient,
      {
        failDeposit: async (transaction: Transaction) => {
          failed = transaction;
        },
      } as unknown as SettlementService,
      reconciliationConfig,
    );

    await service.process({
      ...webhook,
      event: 'transaction.failed',
      data: { ...webhook.data, status: 'failed' },
    });

    assert.equal(failed, pendingDeposit);
  });

  it('marks a signed cancellation distinctly from a failure', async () => {
    let cancelled: Transaction | undefined;
    const service = new ReconciliationService(
      {
        transaction: {
          findFirst: async () => pendingDeposit,
        },
      } as unknown as PrismaService,
      {} as AblinerClient,
      {
        cancelDeposit: async (transaction: Transaction) => {
          cancelled = transaction;
        },
      } as unknown as SettlementService,
      reconciliationConfig,
    );

    await service.process({
      ...webhook,
      event: 'transaction.failed',
      data: { ...webhook.data, status: 'cancelled' },
    });

    assert.equal(cancelled, pendingDeposit);
  });

  it('leaves a transaction pending when Abliner has no matching record', async () => {
    let failed = false;
    const service = new ReconciliationService(
      {} as PrismaService,
      {
        findTransaction: async () => null,
      } as unknown as AblinerClient,
      {
        settleDeposit: async () => undefined,
        failDeposit: async () => {
          failed = true;
        },
      } as unknown as SettlementService,
      reconciliationConfig,
    );

    await service.reconcile(pendingDeposit);

    assert.equal(failed, false);
  });

  it('does not settle a card top-up if the provider confirms the wrong gross amount', async () => {
    let settled = false;
    const cardDeposit = {
      ...pendingDeposit,
      channel: 'card',
      amount: 10_000n,
      fee: 450n,
      total: 10_450n,
    } as Transaction;
    const service = new ReconciliationService(
      {} as PrismaService,
      {
        findTransaction: async () => ({
          ...providerTransaction,
          amount: 10_000,
        }),
      } as unknown as AblinerClient,
      {
        settleDeposit: async () => {
          settled = true;
        },
      } as unknown as SettlementService,
      reconciliationConfig,
    );

    await service.reconcile(cardDeposit);

    assert.equal(settled, false);
  });

  it('settles a matching deposit reported with amount_cents only', async () => {
    let settled = false;
    const service = new ReconciliationService(
      {} as PrismaService,
      {
        findTransaction: async () => ({
          ...providerTransaction,
          amount: undefined,
          amount_cents: 500_000,
        }),
      } as unknown as AblinerClient,
      {
        settleDeposit: async () => {
          settled = true;
        },
      } as unknown as SettlementService,
      reconciliationConfig,
    );

    await service.reconcile(pendingDeposit);

    assert.equal(settled, true);
  });

  it('settles an old pending deposit from the provider during a sweep without a webhook', async () => {
    let checkedReference: string | undefined;
    const reconciliation = new ReconciliationService(
      {} as PrismaService,
      {
        findTransaction: async (query: TransactionLookup) =>
          query.idempotencyKey
            ? { ...providerTransaction, idempotency_key: query.idempotencyKey }
            : null,
      } as unknown as AblinerClient,
      {
        settleDeposit: async (transaction: Transaction) => {
          checkedReference = transaction.reference;
        },
      } as unknown as SettlementService,
      reconciliationConfig,
    );
    const sweeper = new ReconciliationSweeper(
      {
        reconciliation: { enabled: true, staleSeconds: 180, intervalSeconds: 120 },
      } as unknown as AppConfigService,
      {
        transaction: {
          findMany: async () => [pendingDeposit],
        },
      } as unknown as PrismaService,
      reconciliation,
    );

    assert.equal(await sweeper.sweep(), 1);
    assert.equal(checkedReference, pendingDeposit.reference);
  });

  it('resubmits a withdrawal that was never handed to the provider', async () => {
    const unsubmittedWithdrawal = {
      ...pendingWithdrawal,
      id: 'withdrawal-id-2',
      reference: 'WDR-REF-2',
      channel: 'mobileMoney',
      currency: 'TZS',
      counterparty: '255700000001',
    } as Transaction;
    const claims: unknown[] = [];
    const updates: unknown[] = [];
    const submissions: Array<Record<string, unknown>> = [];
    let failed = false;

    const service = new ReconciliationService(
      {
        transaction: {
          updateMany: async (args: unknown) => {
            claims.push(args);
            return { count: 1 };
          },
          update: async (args: unknown) => {
            updates.push(args);
            return unsubmittedWithdrawal;
          },
        },
      } as unknown as PrismaService,
      {
        findTransaction: async () => null,
        createWithdrawal: async (request: Record<string, unknown>) => {
          submissions.push(request);
          return {
            id: 'abl-withdrawal-2',
            status: 'processing',
            amount: 5_000,
            currency: 'TZS',
          };
        },
      } as unknown as AblinerClient,
      {
        failWithdrawal: async () => {
          failed = true;
        },
      } as unknown as SettlementService,
      reconciliationConfig,
    );

    await service.reconcile(unsubmittedWithdrawal);

    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].reference, 'WDR-REF-2');
    assert.equal(submissions[0].recipient, '255700000001');
    assert.equal(submissions[0].idempotencyKey, 'withdrawal-id-2');
    assert.equal(claims.length, 1);
    assert.equal(updates.length, 1);
    assert.equal(failed, false);
  });

  it('does not resubmit when the provider lookup itself failed', async () => {
    let submissions = 0;
    let claims = 0;
    const service = new ReconciliationService(
      {
        transaction: {
          updateMany: async () => {
            claims += 1;
            return { count: 1 };
          },
        },
      } as unknown as PrismaService,
      {
        findTransaction: async () => {
          throw new Error('provider unreachable');
        },
        createWithdrawal: async () => {
          submissions += 1;
          return undefined;
        },
      } as unknown as AblinerClient,
      {} as SettlementService,
      reconciliationConfig,
    );

    await service.reconcile(pendingWithdrawal);

    assert.equal(submissions, 0);
    assert.equal(claims, 0);
  });

  it('does not resubmit a withdrawal that already holds a provider id', async () => {
    let submissions = 0;
    let claims = 0;
    const service = new ReconciliationService(
      {
        transaction: {
          updateMany: async () => {
            claims += 1;
            return { count: 1 };
          },
        },
      } as unknown as PrismaService,
      {
        findTransaction: async () => null,
        createWithdrawal: async () => {
          submissions += 1;
          return undefined;
        },
      } as unknown as AblinerClient,
      {} as SettlementService,
      reconciliationConfig,
    );

    await service.reconcile({
      ...pendingWithdrawal,
      providerRef: 'abl-withdrawal-1',
      internalReference: 'abl-withdrawal-1',
    } as Transaction);

    assert.equal(submissions, 0);
    assert.equal(claims, 0);
  });

  it('releases the hold when the provider definitively rejects the resubmission', async () => {
    const unsubmittedWithdrawal = {
      ...pendingWithdrawal,
      channel: 'mobileMoney',
      currency: 'TZS',
      counterparty: '255700000001',
    } as Transaction;
    const released: Transaction[] = [];
    const service = new ReconciliationService(
      {
        transaction: {
          updateMany: async () => ({ count: 1 }),
        },
      } as unknown as PrismaService,
      {
        findTransaction: async () => null,
        createWithdrawal: async () => {
          throw new AblinerProviderError('invalid_phone', false);
        },
      } as unknown as AblinerClient,
      {
        failWithdrawal: async (transaction: Transaction) => {
          released.push(transaction);
        },
      } as unknown as SettlementService,
      reconciliationConfig,
    );

    await service.reconcile(unsubmittedWithdrawal);

    assert.deepEqual(released, [unsubmittedWithdrawal]);
  });

  it('keeps the hold when the resubmission outcome is unknown', async () => {
    const unsubmittedWithdrawal = {
      ...pendingWithdrawal,
      channel: 'mobileMoney',
      currency: 'TZS',
      counterparty: '255700000001',
    } as Transaction;
    let released = false;
    const service = new ReconciliationService(
      {
        transaction: {
          updateMany: async () => ({ count: 1 }),
        },
      } as unknown as PrismaService,
      {
        findTransaction: async () => null,
        createWithdrawal: async () => {
          throw new AblinerProviderError(undefined, true);
        },
      } as unknown as AblinerClient,
      {
        failWithdrawal: async () => {
          released = true;
        },
      } as unknown as SettlementService,
      reconciliationConfig,
    );

    await service.reconcile(unsubmittedWithdrawal);

    assert.equal(released, false);
  });

  it('skips the resubmission when another instance already claimed it', async () => {
    let submissions = 0;
    const service = new ReconciliationService(
      {
        transaction: {
          updateMany: async () => ({ count: 0 }),
        },
      } as unknown as PrismaService,
      {
        findTransaction: async () => null,
        createWithdrawal: async () => {
          submissions += 1;
          return undefined;
        },
      } as unknown as AblinerClient,
      {} as SettlementService,
      reconciliationConfig,
    );

    await service.reconcile({
      ...pendingWithdrawal,
      channel: 'mobileMoney',
      currency: 'TZS',
      counterparty: '255700000001',
    } as Transaction);

    assert.equal(submissions, 0);
  });
});
