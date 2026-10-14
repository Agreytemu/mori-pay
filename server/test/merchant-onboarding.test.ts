import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import { ConflictException } from '@nestjs/common';

import { AdminRoleGuard } from '../src/merchants/admin-role.guard.js';
import { MerchantsService } from '../src/merchants/merchants.service.js';

const user = {
  id: 'payer-1',
  tier: 'Standard',
  wallet: {
    ledgerAccounts: [{ id: 'wallet-ledger', kind: 'available' }],
  },
};

describe('merchant onboarding and QR payments', () => {
  it('does not accept a registration payment while the fee is unset', async () => {
    let payments = 0;
    const service = new MerchantsService(
      {
        $transaction: async (callback: (tx: unknown) => unknown) =>
          callback({
            merchantConfiguration: { findUnique: async () => null },
          }),
      } as never,
      { loadUserWithWallet: async () => user } as never,
      { paySystem: async () => { payments += 1; } } as never,
      {} as never,
      { verifyPin: async () => undefined } as never,
      {} as never,
    );

    await assert.rejects(
      () =>
        service.payRegistrationFee('payer-1', {
          pin: '123456',
          idempotencyKey: 'registration-payment-1',
        }),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message.includes('not configured'),
    );
    assert.equal(payments, 0);
  });

  it('rejects a consumed one-time QR before invoking the payment executor', async () => {
    let paymentCalls = 0;
    const qrCode = 'a'.repeat(40);
    const service = new MerchantsService(
      {
        merchantQrCode: {
          findUnique: async () => ({
            id: 'qr-1',
            kind: 'fixed',
            fixedAmount: 1_000n,
            reusable: false,
            uses: 1,
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
            merchantAccount: {
              id: 'merchant-1',
              ownerId: 'merchant-owner',
              name: 'Merchant',
              identifier: 'm-123',
              status: 'active',
              ledgerAccountId: 'merchant-ledger',
            },
          }),
        },
        $transaction: async (callback: (tx: unknown) => unknown) =>
          callback({
            transaction: { findUnique: async () => null },
          }),
      } as never,
      { loadUserWithWallet: async () => user } as never,
      {
        paySystem: async () => {
          paymentCalls += 1;
        },
      } as never,
      {} as never,
      { verifyPin: async () => undefined } as never,
      { assertWithinLimits: async () => undefined } as never,
    );

    await assert.rejects(
      () =>
        service.payQr('payer-1', {
          code: qrCode,
          pin: '123456',
          idempotencyKey: 'qr-payment-1',
        }),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message.includes('not available'),
    );
    assert.equal(paymentCalls, 0);
  });

  it('rejects a merchant attempting to pay its own static QR', async () => {
    const service = new MerchantsService(
      {
        merchantQrCode: {
          findUnique: async () => ({
            id: 'qr-2',
            kind: 'static',
            fixedAmount: null,
            reusable: true,
            uses: 0,
            expiresAt: null,
            revokedAt: null,
            merchantAccount: {
              id: 'merchant-1',
              ownerId: 'payer-1',
              name: 'Merchant',
              identifier: 'm-123',
              status: 'active',
              ledgerAccountId: 'merchant-ledger',
            },
          }),
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await assert.rejects(
      () => service.previewQr('payer-1', { code: 'b'.repeat(40), amount: 1_000 }),
      /cannot pay its own QR/,
    );
  });

  it('stores only a hash of a newly issued static QR secret', async () => {
    let stored: Record<string, unknown> | undefined;
    const service = new MerchantsService(
      {
        merchantAccount: {
          findFirst: async () => ({
            id: 'merchant-1',
            ownerId: 'payer-1',
            name: 'Merchant',
            status: 'active',
          }),
        },
        merchantQrCode: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            stored = data;
            return {
              id: 'qr-3',
              kind: 'static',
              fixedAmount: null,
              reusable: true,
              expiresAt: null,
            };
          },
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.createStaticQr('payer-1', {});
    assert.equal(stored?.codeHash, createHash('sha256').update(result.code).digest('hex'));
    assert.notEqual(stored?.codeHash, result.code);
    assert.equal(result.kind, 'static');
  });

  it('requires the persisted user role to be admin for privileged routes', async () => {
    const guard = new AdminRoleGuard({
      user: { findUnique: async () => ({ role: 'user' }) },
    } as never);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { userId: 'payer-1' } }),
      }),
    };

    await assert.rejects(
      () => guard.canActivate(context as never),
      /Administrator access required/,
    );
  });
});
