import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import { ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AdminRoleGuard } from '../src/merchants/admin-role.guard.js';
import { MerchantsService } from '../src/merchants/merchants.service.js';

const user = {
  id: 'payer-1',
  tier: 'Standard',
  wallet: {
    ledgerAccounts: [{ id: 'wallet-ledger', kind: 'available' }],
  },
};

const staticQr = {
  id: 'qr-1',
  kind: 'static',
  fixedAmount: null,
  reusable: true,
  uses: 0,
  expiresAt: null,
  revokedAt: null,
  merchantAccount: {
    id: 'merchant-1',
    ownerId: 'merchant-owner',
    name: 'Merchant',
    identifier: 'm-123',
    status: 'active',
    ledgerAccountId: 'merchant-ledger',
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
      { assertWithinLimits: async () => undefined, assertWithinLimitsForUpdate: async () => undefined } as never,
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

  it('replays a matching QR payment without moving money again', async () => {
    let paymentCalls = 0;
    let storedMetadata: unknown;
    let existing: Record<string, unknown> | null = null;

    const service = new MerchantsService(
      {
        merchantQrCode: {
          findUnique: async () => staticQr,
        },
        $transaction: async (callback: (tx: unknown) => unknown) =>
          callback({
            transaction: { findUnique: async () => existing },
            merchantQrCode: { updateMany: async () => ({ count: 1 }) },
          }),
      } as never,
      { loadUserWithWallet: async () => user } as never,
      {
        paySystem: async (input: { metadata?: unknown }) => {
          paymentCalls += 1;
          storedMetadata = input.metadata;
          return { id: 'tx-1', reference: 'PAY-1', amount: 5_000 };
        },
      } as never,
      {} as never,
      { verifyPin: async () => undefined } as never,
      { assertWithinLimitsForUpdate: async () => undefined } as never,
    );

    const input = {
      code: 'c'.repeat(40),
      pin: '123456',
      idempotencyKey: 'qr-payment-replay',
      amount: 5_000,
    };
    await service.payQr('payer-1', input);
    assert.equal(paymentCalls, 1);

    existing = {
      id: 'tx-1',
      reference: 'PAY-1',
      type: 'payment',
      status: 'completed',
      category: 'merchant_qr',
      channel: 'wallet',
      amount: 5_000n,
      currency: 'TZS',
      fee: 0n,
      feeFlat: 0n,
      feePercentage: 0,
      total: 5_000n,
      counterparty: 'Merchant',
      counterpartyDetail: 'm-123',
      note: null,
      direction: 'debit',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: storedMetadata,
    };

    const replay = await service.payQr('payer-1', input);
    assert.equal(paymentCalls, 1);
    assert.equal(replay.transaction.id, 'tx-1');
    assert.equal(replay.fee, 0);
  });

  it('rejects a replayed key reused for a different QR amount', async () => {
    let paymentCalls = 0;
    const service = new MerchantsService(
      {
        merchantQrCode: {
          findUnique: async () => staticQr,
        },
        $transaction: async (callback: (tx: unknown) => unknown) =>
          callback({
            transaction: {
              findUnique: async () => ({
                id: 'tx-old',
                reference: 'PAY-OLD',
                type: 'payment',
                status: 'completed',
                category: 'merchant_qr',
                channel: 'wallet',
                amount: 1_000n,
                currency: 'TZS',
                fee: 0n,
                feeFlat: 0n,
                feePercentage: 0,
                total: 1_000n,
                counterparty: 'Merchant',
                counterpartyDetail: 'm-123',
                note: null,
                direction: 'debit',
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                metadata: { merchantQrCodeId: 'qr-1' },
              }),
            },
            merchantQrCode: { updateMany: async () => ({ count: 1 }) },
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
      { assertWithinLimitsForUpdate: async () => undefined } as never,
    );

    await assert.rejects(
      () =>
        service.payQr('payer-1', {
          code: 'c'.repeat(40),
          pin: '123456',
          idempotencyKey: 'qr-payment-replay',
          amount: 5_000,
        }),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message.includes('already used'),
    );
    assert.equal(paymentCalls, 0);
  });

  it('rejects a replayed key whose stored fingerprint does not match', async () => {
    let paymentCalls = 0;
    const service = new MerchantsService(
      {
        merchantQrCode: {
          findUnique: async () => staticQr,
        },
        $transaction: async (callback: (tx: unknown) => unknown) =>
          callback({
            transaction: {
              findUnique: async () => ({
                id: 'tx-old',
                reference: 'PAY-OLD',
                type: 'payment',
                status: 'completed',
                category: 'merchant_qr',
                channel: 'wallet',
                amount: 5_000n,
                currency: 'TZS',
                fee: 0n,
                feeFlat: 0n,
                feePercentage: 0,
                total: 5_000n,
                counterparty: 'Merchant',
                counterpartyDetail: 'm-123',
                note: null,
                direction: 'debit',
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                metadata: {
                  merchantQrCodeId: 'qr-1',
                  paymentFingerprint: createHash('sha256').update('other').digest('hex'),
                },
              }),
            },
            merchantQrCode: { updateMany: async () => ({ count: 1 }) },
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
      { assertWithinLimitsForUpdate: async () => undefined } as never,
    );

    await assert.rejects(
      () =>
        service.payQr('payer-1', {
          code: 'c'.repeat(40),
          pin: '123456',
          idempotencyKey: 'qr-payment-replay',
          amount: 5_000,
        }),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message.includes('already used'),
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
    } as never, new Reflector());
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

  it('allows a reusable fixed QR without an expiry', async () => {
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
              id: 'qr-4',
              kind: 'fixed',
              fixedAmount: 1_000n,
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

    const result = await service.createFixedQr('payer-1', {
      amount: 1_000,
      reusable: true,
    });

    assert.equal(result.kind, 'fixed');
    assert.equal(result.amount, 1_000);
    assert.equal(result.expiresAt, undefined);
    assert.equal(stored?.expiresAt, null);
  });

  it('rejects a fixed QR whose expiry is in the past', async () => {
    let creates = 0;
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
          create: async () => {
            creates += 1;
            return {};
          },
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await assert.rejects(
      () =>
        service.createFixedQr('payer-1', {
          amount: 1_000,
          reusable: false,
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        }),
      /expiry must be in the future/,
    );
    assert.equal(creates, 0);
  });
});
