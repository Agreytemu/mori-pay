import assert from 'node:assert/strict';
import test from 'node:test';

import { ConflictException } from '@nestjs/common';

import { verifyPasswordHash } from '../src/common/crypto.js';
import { InitialSuperAdminBootstrap } from '../src/admin/initial-super-admin.bootstrap.js';

function bootstrap(
  values: Record<string, string | undefined>,
  transaction: (callback: (tx: unknown) => Promise<unknown>, options: unknown) => Promise<unknown>,
) {
  const config = {
    get: (key: string) => values[key],
  };
  return new InitialSuperAdminBootstrap(
    { $transaction: transaction } as never,
    config as never,
  );
}

test('initial admin bootstrap is a no-op when one-time credentials are absent', async () => {
  let transactionCalls = 0;
  const service = bootstrap({}, async () => {
    transactionCalls += 1;
    return undefined;
  });

  await service.onApplicationBootstrap();
  assert.equal(transactionCalls, 0);
});

test('initial admin bootstrap skips creation when a super admin already exists', async () => {
  const calls: string[] = [];
  const service = bootstrap(
    {
      INITIAL_SUPER_ADMIN_EMAIL: 'root@example.com',
      INITIAL_SUPER_ADMIN_PASSWORD: 'a-long-bootstrap-password',
    },
    async (callback, options) => {
      assert.deepEqual(options, { isolationLevel: 'ReadCommitted' });
      return callback({
        $executeRaw: async () => { calls.push('lock'); },
        user: {
          findFirst: async () => {
            calls.push('existing-super-admin');
            return { id: 'existing-admin' };
          },
          create: async () => { calls.push('user-create'); },
        },
      });
    },
  );

  await service.onApplicationBootstrap();
  assert.deepEqual(calls, ['lock', 'existing-super-admin']);
});

test('initial admin bootstrap creates a verified admin wallet and ledger once', async () => {
  const calls: Array<{ model: string; data: Record<string, unknown> }> = [];
  const service = bootstrap(
    {
      INITIAL_SUPER_ADMIN_EMAIL: 'root@example.com',
      INITIAL_SUPER_ADMIN_PASSWORD: 'a-long-bootstrap-password',
      INITIAL_SUPER_ADMIN_NAME: 'Root Admin',
    },
    async (callback) => callback({
      $executeRaw: async () => undefined,
      user: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) => {
          calls.push({ model: 'user.findFirst', data: where });
          return null;
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          calls.push({ model: 'user.create', data });
          return { id: 'initial-admin' };
        },
      },
      wallet: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          calls.push({ model: 'wallet.create', data });
          return { id: 'initial-wallet' };
        },
      },
      ledgerAccount: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          calls.push({ model: 'ledgerAccount.create', data });
        },
      },
      auditLog: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          calls.push({ model: 'auditLog.create', data });
        },
      },
    }),
  );

  await service.onApplicationBootstrap();

  const user = calls.find((call) => call.model === 'user.create')?.data;
  assert.equal(user?.email, 'root@example.com');
  assert.equal(user?.emailVerifiedAt instanceof Date, true);
  assert.equal(user?.role, 'admin');
  assert.equal(user?.adminStaffRole, 'super_admin');
  assert.equal(user?.status, 'active');
  assert.equal(user?.fullName, 'Root Admin');
  assert.equal(user?.firstName, 'Root');
  assert.equal(
    await verifyPasswordHash(
      'a-long-bootstrap-password',
      user?.passwordHash as string,
    ),
    true,
  );
  assert.equal(calls.find((call) => call.model === 'wallet.create')?.data.userId, 'initial-admin');
  assert.deepEqual(calls.find((call) => call.model === 'ledgerAccount.create')?.data, {
    walletId: 'initial-wallet',
    kind: 'available',
    currency: 'TZS',
    balance: 0n,
  });
  assert.equal(calls.some((call) => call.model === 'auditLog.create'), true);
});

test('initial admin bootstrap refuses to promote an existing account by email', async () => {
  let lookupCount = 0;
  let createCalled = false;
  const noExistingSuperAdmin = bootstrap(
    {
      INITIAL_SUPER_ADMIN_EMAIL: 'existing@example.com',
      INITIAL_SUPER_ADMIN_PASSWORD: 'a-long-bootstrap-password',
    },
    async (callback) => callback({
      $executeRaw: async () => undefined,
      user: {
        findFirst: async () => {
          lookupCount += 1;
          return lookupCount === 1 ? null : { id: 'regular-user' };
        },
        create: async () => { createCalled = true; },
      },
    }),
  );

  await assert.rejects(
    () => noExistingSuperAdmin.onApplicationBootstrap(),
    (error: unknown) => error instanceof ConflictException,
  );
  assert.equal(createCalled, false);
});
