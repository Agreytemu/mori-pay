import assert from 'node:assert/strict';
import test from 'node:test';

import { Reflector } from '@nestjs/core';
import {
  capabilitiesForAdminRole,
  adminAuditQuerySchema,
  adminSearchQuerySchema,
} from '@mori-pay/contracts';

import { AdminController } from '../src/admin/admin.controller.js';
import { AdminService } from '../src/admin/admin.service.js';
import { AdminRoleGuard } from '../src/merchants/admin-role.guard.js';

function guardFor(
  role: string | null,
  staffRole: string | null = role === 'admin' ? 'super_admin' : null,
  required?: string[],
) {
  return new AdminRoleGuard({
    user: {
      findUnique: async () =>
        role ? { role, status: 'active', adminStaffRole: staffRole } : null,
    },
  } as never, {
    getAllAndOverride: () => required,
  } as never);
}

function contextFor(userId?: string) {
  return {
    getHandler: () => contextFor,
    getClass: () => Object,
    switchToHttp: () => ({
      getRequest: () => (userId ? { user: { userId } } : { user: undefined }),
    }),
  } as never;
}

test('admin session endpoint requires an authenticated admin role', async () => {
  assert.equal(await guardFor('admin').canActivate(contextFor('staff-1')), true);
  await assert.rejects(
    () => guardFor('admin', null).canActivate(contextFor('staff-without-role')),
    /Administrator access required/,
  );
  await assert.rejects(
    () => guardFor('user').canActivate(contextFor('customer-1')),
    /Administrator access required/,
  );
  await assert.rejects(
    () => guardFor(null).canActivate(contextFor('deleted-user')),
    /Administrator access required/,
  );
  await assert.rejects(
    () => guardFor('admin').canActivate(contextFor()),
    /Administrator access required/,
  );
});

test('admin role is denied when the user account is not active', async () => {
  const guard = new AdminRoleGuard({
    user: {
      findUnique: async () => ({ role: 'admin', status: 'restricted', adminStaffRole: 'super_admin' }),
    },
  } as never, new Reflector());
  await assert.rejects(
    () => guard.canActivate(contextFor('restricted-staff')),
    /Administrator access required/,
  );
});

test('admin session returns its persisted role and capabilities', async () => {
  const session = await new AdminController({
    staffRole: async () => 'finance_reconciliation',
  } as never).session({
    userId: 'staff-1',
    sessionId: 'session-1',
  });
  assert.deepEqual(session, {
    userId: 'staff-1',
    role: 'admin',
    staffRole: 'finance_reconciliation',
    capabilities: [...capabilitiesForAdminRole('finance_reconciliation')],
  });
});

test('admin guard enforces persisted staff capabilities', async () => {
  assert.equal(
    await guardFor('admin', 'merchant_operations', ['admin:merchant:write'])
      .canActivate(contextFor('merchant-operator')),
    true,
  );
  await assert.rejects(
    () => guardFor('admin', 'merchant_operations', ['admin:user:read'])
      .canActivate(contextFor('merchant-operator')),
    /Administrator capability required/,
  );
});

test('staff role changes revoke sessions and write their audit entry atomically', async () => {
  const calls: string[] = [];
  let transactionOptions: unknown;
  const service = new AdminService({
    $transaction: async (
      callback: (tx: unknown) => Promise<unknown>,
      options: unknown,
    ) => {
      transactionOptions = options;
      return callback({
        user: {
          findUnique: async ({ where }: { where: { id: string } }) =>
            where.id === 'actor'
              ? { role: 'admin', status: 'active', adminStaffRole: 'super_admin' }
              : { id: where.id, status: 'active', emailVerifiedAt: new Date(), adminStaffRole: null },
          update: async (input: unknown) => { calls.push(`user:${JSON.stringify(input)}`); },
          count: async () => 2,
        },
        refreshToken: {
          updateMany: async (input: unknown) => { calls.push(`refresh:${JSON.stringify(input)}`); },
        },
        auditLog: {
          create: async (input: unknown) => { calls.push(`audit:${JSON.stringify(input)}`); },
        },
      });
    },
  } as never, {} as never, {} as never);

  const result = await service.updateStaffRole(
    'new-staff',
    'customer_support',
    'actor',
    { ip: '127.0.0.1' },
  );

  assert.deepEqual(result, { userId: 'new-staff', staffRole: 'customer_support' });
  assert.deepEqual(transactionOptions, { isolationLevel: 'Serializable' });
  assert.equal(calls.length, 3);
  assert.match(calls[0] ?? '', /adminStaffRole":"customer_support"/);
  assert.match(calls[1] ?? '', /userId":"new-staff","revokedAt":null/);
  assert.match(calls[2] ?? '', /admin\.staff\.role\.update/);
});

test('staff role changes cannot remove the last active super administrator', async () => {
  let roleUpdateCalled = false;
  const service = new AdminService({
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        user: {
          findUnique: async ({ where }: { where: { id: string } }) =>
            where.id === 'actor'
              ? { role: 'admin', status: 'active', adminStaffRole: 'super_admin' }
              : { id: where.id, status: 'active', adminStaffRole: 'super_admin' },
          count: async () => 1,
          update: async () => { roleUpdateCalled = true; },
        },
        refreshToken: { updateMany: async () => undefined },
        auditLog: { create: async () => undefined },
      }),
  } as never, {} as never, {} as never);

  await assert.rejects(
    () => service.updateStaffRole('last-admin', null, 'actor', {}),
    /last active super administrator/,
  );
  assert.equal(roleUpdateCalled, false);
});

test('staff role changes cannot demote the acting administrator', async () => {
  let transactionStarted = false;
  const service = new AdminService({
    $transaction: async () => { transactionStarted = true; },
  } as never, {} as never, {} as never);
  await assert.rejects(
    () => service.updateStaffRole('actor', null, 'actor', {}),
    /cannot change your own/,
  );
  assert.equal(transactionStarted, false);
});

test('staff search is bounded, masked, and does not audit the search term', async () => {
  let auditInput: { data: { metadata: Record<string, unknown> } } | undefined;
  let searchWhere: unknown;
  const service = new AdminService({
    auditLog: {
      create: async (input: typeof auditInput) => { auditInput = input; },
    },
    user: {
      findMany: async (input: { where: unknown }) => {
        searchWhere = input.where;
        return [{
          id: 'candidate-id',
          fullName: 'Amani Test',
          phone: '+255712345678',
          email: 'amani@example.com',
          memberId: 'MP12345678',
          status: 'active',
          adminStaffRole: null,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        }];
      },
      count: async () => 1,
    },
  } as never, {} as never, {} as never);

  const result = await service.searchStaff(
    { q: 'amani', page: 1, pageSize: 20 },
    'super-admin',
    {},
  );

  assert.match(JSON.stringify(searchWhere), /emailVerifiedAt/);
  assert.match(JSON.stringify(searchWhere), /adminStaffRole/);
  assert.equal(result.items[0]?.phone, '*********5678');
  assert.equal(result.items[0]?.email, '****i@example.com');
  assert.equal(result.items[0]?.memberId, '******5678');
  assert.deepEqual(auditInput?.data.metadata, { page: 1, pageSize: 20, queryLength: 5 });
  assert.equal(JSON.stringify(auditInput).includes('amani'), false);
});

test('staff role assignment rejects a user without a verified email', async () => {
  let roleUpdateCalled = false;
  const service = new AdminService({
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        user: {
          findUnique: async ({ where }: { where: { id: string } }) =>
            where.id === 'actor'
              ? { role: 'admin', status: 'active', adminStaffRole: 'super_admin' }
              : { id: where.id, status: 'active', emailVerifiedAt: null, adminStaffRole: null },
          update: async () => { roleUpdateCalled = true; },
        },
        refreshToken: { updateMany: async () => undefined },
        auditLog: { create: async () => undefined },
      }),
  } as never, {} as never, {} as never);

  await assert.rejects(
    () => service.updateStaffRole('unverified-user', 'customer_support', 'actor', {}),
    /verified email/,
  );
  assert.equal(roleUpdateCalled, false);
});

test('admin record searches require bounded terms and pagination', () => {
  assert.equal(adminSearchQuerySchema.safeParse({ q: '  255712345678  ' }).success, true);
  assert.equal(adminSearchQuerySchema.safeParse({ q: 'ab' }).success, false);
  assert.equal(adminSearchQuerySchema.safeParse({ q: 'x'.repeat(81) }).success, false);
  assert.equal(adminSearchQuerySchema.safeParse({ q: 'valid', pageSize: 101 }).success, false);
  assert.equal(adminSearchQuerySchema.safeParse({ q: 'valid', page: 10_001 }).success, false);
});

test('audit filters validate minimum action length and date ordering', () => {
  assert.equal(adminAuditQuerySchema.safeParse({ action: 'admin.user.view' }).success, true);
  assert.equal(adminAuditQuerySchema.safeParse({ action: 'ab' }).success, false);
  assert.equal(adminAuditQuerySchema.safeParse({
    from: '2026-02-01T00:00:00.000Z',
    to: '2026-01-01T00:00:00.000Z',
  }).success, false);
});

test('system settings expose effective operational configuration without secrets', async () => {
  const service = new AdminService({
    merchantConfiguration: {
      findUnique: async () => ({ registrationFeeAmount: 15000n }),
    },
    feeRule: {
      findMany: async () => [{
        id: 'fee-rule-1',
        type: 'withdrawal',
        channel: 'mobile_money',
        flat: 1000n,
        percentage: 0.025,
        minAmount: 1000n,
        maxAmount: null,
        active: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }],
    },
  } as never, {
    limits: {
      standard: { dailyOutflow: 1000000n, perTransaction: 500000n },
      verified: { dailyOutflow: 5000000n, perTransaction: 3000000n },
    },
    reconciliation: { enabled: true, intervalSeconds: 30, staleSeconds: 120 },
    abliner: { baseUrl: 'https://provider.example', apiKey: 'api-secret', webhookSecret: 'webhook-secret' },
    email: { apiKey: 'email-secret', smtp: { host: '', user: '', pass: '' } },
    sms: { provider: 'console', apiKey: 'sms-secret' },
  } as never, {} as never);

  const result = await service.systemSettings();
  const serialized = JSON.stringify(result);
  assert.equal(result.merchantRegistrationFee, '15000');
  assert.equal(result.feeRules[0]?.flat, '1000');
  assert.equal(result.tierLimits.standard.dailyOutflow, '1000000');
  assert.equal(result.reconciliation.enabled, true);
  assert.deepEqual(result.integrations.map(({ configuration }) => configuration), [
    'configured',
    'configured',
    'configured',
  ]);
  assert.equal(serialized.includes('api-secret'), false);
  assert.equal(serialized.includes('webhook-secret'), false);
  assert.equal(serialized.includes('email-secret'), false);
  assert.equal(serialized.includes('sms-secret'), false);
});

test('overview reports transaction channels and webhook error counts', async () => {
  const webhookCountFilters: unknown[] = [];
  const service = new AdminService({
    user: { count: async () => 10 },
    merchantApplication: { count: async () => 3 },
    merchantAccount: { count: async () => 4 },
    transaction: {
      count: async () => 5,
      groupBy: async () => [
        { channel: 'card', _count: { _all: 2 } },
        { channel: 'mobile_money', _count: { _all: 3 } },
      ],
    },
    ablinerWebhookEvent: {
      count: async ({ where }: { where: unknown }) => {
        webhookCountFilters.push(where);
        return webhookCountFilters.length === 1 ? 4 : 2;
      },
    },
  } as never, {} as never, {} as never);

  const overview = await service.overview();

  assert.deepEqual(overview.transactions.byChannel, [
    { channel: 'card', count: 2 },
    { channel: 'mobile_money', count: 3 },
  ]);
  assert.deepEqual(overview.webhookEvents, { awaitingProcessing: 4, failedProcessing: 2 });
  assert.deepEqual(webhookCountFilters, [
    { processedAt: null },
    { error: { not: null } },
  ]);
});

test('audit query applies filters and bounded pagination', async () => {
  let capturedWhere: unknown;
  let capturedSkip = -1;
  const service = new AdminService({
    auditLog: {
      findMany: async (query: { where: unknown; skip: number }) => {
        capturedWhere = query.where;
        capturedSkip = query.skip;
        return [];
      },
      count: async ({ where }: { where: unknown }) => {
        assert.deepEqual(where, capturedWhere);
        return 0;
      },
    },
  } as never, {} as never, {} as never);
  const from = new Date('2026-01-01T00:00:00.000Z');
  const to = new Date('2026-01-31T23:59:59.999Z');

  const result = await service.audit({
    page: 3,
    pageSize: 10,
    action: 'admin.user',
    from,
    to,
  });

  assert.deepEqual(capturedWhere, {
    action: { contains: 'admin.user', mode: 'insensitive' },
    createdAt: { gte: from, lte: to },
  });
  assert.equal(capturedSkip, 20);
  assert.equal(result.total, 0);
});

test('user search audits access and returns only masked contact identifiers', async () => {
  const auditRecords: unknown[] = [];
  let capturedQuery: unknown;
  const service = new AdminService({
    auditLog: {
      create: async (record: unknown) => { auditRecords.push(record); },
    },
    user: {
      findMany: async (query: unknown) => {
        capturedQuery = query;
        return [{
          id: 'user-id',
          fullName: 'Amani Test',
          phone: '+255712345678',
          email: 'amani@example.com',
          memberId: 'MP12345678',
          status: 'active',
          tier: 'Verified',
          kycLevel: 2,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        }];
      },
      count: async () => 1,
    },
    refreshToken: {
      groupBy: async () => [{
        userId: 'user-id',
        _count: { _all: 2 },
        _max: { createdAt: new Date() },
      }],
    },
    device: {
      groupBy: async () => [{
        userId: 'user-id',
        _count: { _all: 1 },
        _max: { lastActiveAt: new Date() },
      }],
    },
  } as never, {} as never, {} as never);

  const result = await service.searchUsers(
    { q: 'Amani', page: 2, pageSize: 10 },
    'staff-id',
    { ip: '127.0.0.1', userAgent: 'test-agent' },
  );

  assert.equal(result.items[0]?.phone, '*********5678');
  assert.equal(result.items[0]?.id, 'user-id');
  assert.equal(result.items[0]?.email, '****i@example.com');
  assert.equal(result.items[0]?.memberId, '******5678');
  assert.equal(result.items[0]?.name, 'Amani Test');
  assert.equal(result.items[0]?.isOnline, true);
  assert.equal(result.items[0]?.activeSessions, 2);
  assert.equal(result.items[0]?.deviceCount, 1);
  assert.equal(result.page, 2);
  assert.equal((capturedQuery as { skip: number }).skip, 10);
  assert.equal(auditRecords.length, 1);
  assert.deepEqual(auditRecords[0], {
    data: {
      userId: 'staff-id',
      action: 'admin.user.search',
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      metadata: { page: 2, pageSize: 10, queryLength: 5 },
    },
  });
});

test('administrators can browse users and transactions without a search term', async () => {
  let userWhere: unknown;
  let transactionWhere: unknown;
  const service = new AdminService({
    auditLog: { create: async () => undefined },
    user: {
      findMany: async (query: { where: unknown }) => { userWhere = query.where; return []; },
      count: async () => 0,
    },
    transaction: {
      findMany: async (query: { where: unknown }) => { transactionWhere = query.where; return []; },
      count: async () => 0,
    },
  } as never, {} as never, {} as never);

  const users = await service.searchUsers({ page: 1, pageSize: 25 }, 'staff-id', {});
  const transactions = await service.searchTransactions({ page: 1, pageSize: 25 }, 'staff-id', {});

  assert.deepEqual(userWhere, {});
  assert.deepEqual(transactionWhere, {});
  assert.equal(users.total, 0);
  assert.equal(transactions.total, 0);
});

test('transaction search matches provider and internal references by substring', async () => {
  let capturedWhere: unknown;
  const service = new AdminService({
    auditLog: { create: async () => undefined },
    transaction: {
      findMany: async (query: { where: unknown }) => { capturedWhere = query.where; return []; },
      count: async () => 0,
    },
  } as never, {} as never, {} as never);

  await service.searchTransactions({ q: 'AB-7788', page: 1, pageSize: 25 }, 'staff-id', {});

  assert.match(JSON.stringify(capturedWhere), /internalReference/);
  assert.match(JSON.stringify(capturedWhere), /providerRef/);
  assert.match(JSON.stringify(capturedWhere), /contains/);
});

test('fee rule management validates ranges and audits every change', async () => {
  const auditActions: string[] = [];
  let createdData: { maxAmount: bigint | null } | undefined;
  const service = new AdminService({
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        feeRule: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            createdData = { maxAmount: data.maxAmount as bigint | null };
            return { id: 'fee-1', type: data.type, channel: null, flat: 0n, percentage: 0, minAmount: 100n, maxAmount: data.maxAmount as bigint | null, active: true, createdAt: new Date() };
          },
          findUnique: async () => ({ id: 'fee-1', type: 'send', channel: null, minAmount: 100n, maxAmount: 900n }),
          update: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'fee-1', type: 'send', channel: null, flat: 0n, percentage: 0, minAmount: 100n, maxAmount: 900n, active: true, createdAt: new Date(), ...data }),
          delete: async () => undefined,
        },
        auditLog: { create: async ({ data }: { data: { action: string } }) => { auditActions.push(data.action); } },
      }),
  } as never, {} as never, {} as never);

  const created = await service.createFeeRule(
    { type: 'send', flat: 0, percentage: 0.01, minAmount: 100, maxAmount: 900, active: true },
    'staff-id',
    {},
  );
  assert.equal(created.id, 'fee-1');
  assert.equal(createdData?.maxAmount, 900n);

  await assert.rejects(
    () => service.createFeeRule(
      { type: 'send', flat: 0, percentage: 0.01, minAmount: 900, maxAmount: 100, active: true },
      'staff-id',
      {},
    ),
    /greater than or equal/,
  );

  await service.updateFeeRule('fee-1', { active: false }, 'staff-id', {});
  await service.deleteFeeRule('fee-1', 'staff-id', {});

  assert.deepEqual(auditActions, [
    'admin.feeRule.create',
    'admin.feeRule.update',
    'admin.feeRule.delete',
  ]);
});

test('transaction search audits access and serializes monetary values without leaking provider references', async () => {
  const auditRecords: unknown[] = [];
  let capturedQuery: unknown;
  const service = new AdminService({
    auditLog: {
      create: async (record: unknown) => { auditRecords.push(record); },
    },
    transaction: {
      findMany: async (query: unknown) => {
        capturedQuery = query;
        return [{
          id: 'transaction-id',
          reference: 'MORI-2026-12345678',
          type: 'deposit',
          status: 'pending',
          category: 'wallet',
          channel: 'mobile_money',
          direction: 'in',
          amount: 100000n,
          fee: 500n,
          total: 100500n,
          currency: 'TZS',
          provider: 'Abliner',
          providerStatus: 'processing',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          settledAt: null,
          user: {
            fullName: 'Amani Test',
            phone: '+255712345678',
            memberId: 'MP12345678',
          },
        }];
      },
      count: async () => 1,
    },
  } as never, {} as never, {} as never);

  const result = await service.searchTransactions(
    { q: 'MORI', page: 1, pageSize: 20 },
    'staff-id',
    {},
  );

  assert.equal(result.items[0]?.amount, '100000');
  assert.equal(result.items[0]?.id, 'transaction-id');
  assert.equal(result.items[0]?.fee, '500');
  assert.equal(result.items[0]?.total, '100500');
  assert.equal(result.items[0]?.reference, '**************5678');
  assert.equal(result.items[0]?.user.phone, '*********5678');
  assert.equal(result.items[0]?.provider, 'Abliner');
  assert.equal('providerRef' in (result.items[0] ?? {}), false);
  assert.equal((capturedQuery as { skip: number }).skip, 0);
  assert.equal(auditRecords.length, 1);
  assert.deepEqual(auditRecords[0], {
    data: {
      userId: 'staff-id',
      action: 'admin.transaction.search',
      ip: null,
      userAgent: null,
      metadata: { page: 1, pageSize: 20, queryLength: 4 },
    },
  });
});

test('user detail is audited and excludes wallet balances, credentials, and device tokens', async () => {
  const auditRecords: unknown[] = [];
  const service = new AdminService({
    auditLog: { create: async (record: unknown) => { auditRecords.push(record); } },
    user: {
      findUnique: async () => ({
        id: 'user-id',
        fullName: 'Amani Test',
        phone: '+255712345678',
        email: 'amani@example.com',
        memberId: 'MP12345678',
        status: 'active',
        tier: 'Verified',
        kycLevel: 2,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        wallet: {
          currency: 'TZS',
          status: 'active',
          accountNumber: '2557000012345678',
          balance: 999999999n,
        },
        devices: [{
          platform: 'android',
          lastActiveAt: new Date('2026-01-03T00:00:00.000Z'),
          isCurrent: true,
          pushToken: 'secret-push-token',
        }],
      }),
    },
    refreshToken: {
      count: async () => 2,
    },
  } as never, {} as never, {} as never);

  const result = await service.userDetail('user-id', 'staff-id', {
    ip: '127.0.0.1',
    userAgent: 'test-agent',
  });

  assert.equal(result.wallet?.accountNumber, '************5678');
  assert.deepEqual(result.sessions, { active: 2, revoked: 2 });
  assert.equal(JSON.stringify(result).includes('999999999'), false);
  assert.equal(JSON.stringify(result).includes('secret-push-token'), false);
  assert.equal(JSON.stringify(result).includes('password'), false);
  assert.deepEqual(auditRecords[0], {
    data: {
      userId: 'staff-id',
      action: 'admin.user.view',
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      metadata: { targetId: 'user-id' },
    },
  });
});

test('transaction detail exposes read-only ledger and reconciliation summaries without raw secrets', async () => {
  const auditRecords: unknown[] = [];
  const service = new AdminService({
    auditLog: { create: async (record: unknown) => { auditRecords.push(record); } },
    transaction: {
      findUnique: async () => ({
        id: 'transaction-id',
        reference: 'MORI-2026-12345678',
        internalReference: 'internal-reference',
        providerRef: 'provider-secret-reference',
        type: 'deposit',
        status: 'pending',
        category: 'wallet',
        channel: 'mobile_money',
        direction: 'in',
        amount: 100000n,
        fee: 500n,
        total: 100500n,
        currency: 'TZS',
        provider: 'Abliner',
        providerStatus: 'processing',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:01:00.000Z'),
        settledAt: null,
        user: {
          fullName: 'Amani Test',
          phone: '+255712345678',
          memberId: 'MP12345678',
        },
        ledgerEntries: [{
          direction: 'credit',
          amount: 100000n,
          balanceAfter: 5000000n,
          createdAt: new Date('2026-01-02T00:00:30.000Z'),
          ledgerAccount: { kind: 'wallet' },
        }],
      }),
    },
    ablinerWebhookEvent: {
      findMany: async () => [{
        event: 'transaction.completed',
        processedAt: null,
        error: 'internal provider failure detail',
        createdAt: new Date('2026-01-02T00:02:00.000Z'),
        payload: { secret: 'raw-webhook-payload' },
      }],
    },
  } as never, {} as never, {} as never);

  const result = await service.transactionDetail('transaction-id', 'staff-id', {});

  assert.equal(result.ledgerEntries[0]?.amount, '100000');
  assert.equal(result.ledgerEntries[0]?.direction, 'credit');
  assert.equal(result.reconciliationEvents[0]?.errorPresent, true);
  assert.equal(JSON.stringify(result).includes('5000000'), false);
  assert.equal(JSON.stringify(result).includes('provider-secret-reference'), false);
  assert.equal(JSON.stringify(result).includes('internal provider failure detail'), false);
  assert.equal(JSON.stringify(result).includes('raw-webhook-payload'), false);
  assert.deepEqual(auditRecords[0], {
    data: {
      userId: 'staff-id',
      action: 'admin.transaction.view',
      ip: null,
      userAgent: null,
      metadata: { targetId: 'transaction-id' },
    },
  });
});

test('approving a KYC submission verifies the user and records the decision atomically', async () => {
  const calls: string[] = [];
  const service = new AdminService({
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        kycSubmission: {
          findUnique: async () => ({ id: 'kyc-1', userId: 'user-1', status: 'pending' }),
          update: async (input: unknown) => { calls.push(`submission:${JSON.stringify(input)}`); },
        },
        user: {
          findUnique: async () => ({ kycLevel: 0 }),
          update: async (input: unknown) => { calls.push(`user:${JSON.stringify(input)}`); },
        },
        auditLog: {
          create: async (input: unknown) => { calls.push(`audit:${JSON.stringify(input)}`); },
        },
      }),
  } as never, {} as never, {} as never);

  const result = await service.decideKycSubmission('kyc-1', { decision: 'approve' }, 'staff-id', {});

  assert.deepEqual(result, { id: 'kyc-1', status: 'approved' });
  assert.match(calls[0] ?? '', /"status":"approved"/);
  assert.match(calls[1] ?? '', /"tier":"Verified"/);
  assert.match(calls[1] ?? '', /"kycLevel":1/);
  assert.match(calls[2] ?? '', /admin\.kyc\.decision/);
});

test('rejecting a KYC submission requires a reason', async () => {
  const service = new AdminService({
    $transaction: async () => {
      throw new Error('transaction must not start without a rejection reason');
    },
  } as never, {} as never, {} as never);

  await assert.rejects(
    () => service.decideKycSubmission('kyc-1', { decision: 'reject' }, 'staff-id', {}),
    /reason is required/,
  );
});
