import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BadRequestException } from '@nestjs/common';

import { AccountService } from '../src/account/account.service.js';
import type { AppConfigService } from '../src/config/app-config.service.js';
import type { PaymentProviderSettingsService } from '../src/payments/payment-provider-settings.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const encryptionKey = Buffer.alloc(32, 7).toString('base64');

function row(data: Record<string, unknown>) {
  return {
    id: 'method-1',
    kind: data.kind as string,
    provider: data.provider as string,
    identifier: data.identifier as string,
    encryptedPhoneNumber: (data.encryptedPhoneNumber as string | null) ?? null,
    network: (data.network as string | null) ?? null,
    isDefault: data.isDefault as boolean,
    status: 'Active',
    createdAt: new Date('2026-10-18T00:00:00.000Z'),
  };
}

describe('AccountService saved mobile-money methods', () => {
  it('stores a canonical network with the encrypted phone number', async () => {
    const createdData: Record<string, unknown>[] = [];
    const prisma = {
      savedPaymentMethod: { count: async () => 0 },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          savedPaymentMethod: {
            updateMany: async () => ({ count: 0 }),
            create: async ({ data }: { data: Record<string, unknown> }) => {
              createdData.push(data);
              return row(data);
            },
          },
        }),
    } as unknown as PrismaService;
    const config = {
      paymentMethodEncryptionKey: encryptionKey,
    } as unknown as AppConfigService;
    const providerSettings = {
      assertPaymentMethodEnabled: async () => undefined,
    } as unknown as PaymentProviderSettingsService;
    const service = new AccountService(prisma, config, providerSettings);

    const result = await service.savePaymentMethod('user-1', {
      kind: 'mobile-money',
      provider: 'Mixx by Yas',
      lastFour: '5678',
      phoneNumber: '255712345678',
    });

    assert.equal(createdData[0]?.network, 'TigoPesa');
    assert.equal(result.usableForDeposit, true);
    assert.equal(result.lastFour, '5678');
  });

  it('rejects an unsupported mobile-money provider', async () => {
    const service = new AccountService(
      {} as PrismaService,
      { paymentMethodEncryptionKey: encryptionKey } as unknown as AppConfigService,
      {
        assertPaymentMethodEnabled: async () => undefined,
      } as unknown as PaymentProviderSettingsService,
    );

    await assert.rejects(
      () =>
        service.savePaymentMethod('user-1', {
          kind: 'mobile-money',
          provider: 'Unknown Wallet',
          lastFour: '5678',
          phoneNumber: '255712345678',
        }),
      BadRequestException,
    );
  });

  it('rejects creating a payment method hidden by the administrator', async () => {
    const service = new AccountService(
      {} as PrismaService,
      { paymentMethodEncryptionKey: encryptionKey } as unknown as AppConfigService,
      {
        assertPaymentMethodEnabled: async () => {
          throw new BadRequestException('disabled by administrator');
        },
      } as unknown as PaymentProviderSettingsService,
    );

    await assert.rejects(
      () =>
        service.savePaymentMethod('user-1', {
          kind: 'card',
          provider: 'Card',
          lastFour: '5678',
        }),
      BadRequestException,
    );
  });
});
