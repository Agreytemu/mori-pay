import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BadRequestException } from '@nestjs/common';

import { decryptField } from '../src/common/field-encryption.js';
import { KycService } from '../src/kyc/kyc.service.js';
import type { AppConfigService } from '../src/config/app-config.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const encryptionKey = Buffer.alloc(32, 5).toString('base64');
const kycDecryptOptions = {
  envName: 'PAYMENT_METHOD_ENCRYPTION_KEY',
  invalidMessage: 'Stored KYC data is invalid.',
};

function harness(options: { tier?: string; kycLevel?: number; hasPending?: boolean } = {}) {
  const { tier = 'Standard', kycLevel = 0, hasPending = false } = options;
  const created: Record<string, unknown> = {};
  const prisma = {
    user: {
      findUniqueOrThrow: async () => ({ tier, kycLevel }),
    },
    kycSubmission: {
      findFirst: async (args: { where?: { status?: string } }) => {
        if (args?.where?.status === 'pending') {
          return hasPending ? { id: 'pending-1' } : null;
        }
        return Object.keys(created).length > 0 ? created : null;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        Object.assign(created, {
          id: 'kyc-1',
          userId: args.data.userId,
          documentType: args.data.documentType,
          documentNumber: args.data.documentNumber,
          documentNumberLast4: args.data.documentNumberLast4,
          documentImage: args.data.documentImage,
          status: 'pending',
          rejectionReason: null,
          reviewedAt: null,
          createdAt: new Date('2026-10-24T10:00:00.000Z'),
          updatedAt: new Date('2026-10-24T10:00:00.000Z'),
        });
        return created;
      },
    },
  } as unknown as PrismaService;
  const config = { paymentMethodEncryptionKey: encryptionKey } as unknown as AppConfigService;
  return { service: new KycService(prisma, config), created };
}

const validInput = {
  documentType: 'nida' as const,
  documentNumber: '19900101-12345-6789',
  documentImage: 'data:image/jpeg;base64,AAAA',
};

describe('KycService submit', () => {
  it('encrypts the ID number and returns only a masked last-4', async () => {
    const { service, created } = harness();

    const overview = await service.submit('user-1', validInput);

    assert.equal(overview.status, 'pending');
    assert.equal(overview.latest?.documentNumberLast4, '6789');
    assert.equal(JSON.stringify(overview).includes('19900101'), false);

    const stored = created.documentNumber as string;
    assert.notEqual(stored, validInput.documentNumber);
    assert.equal(
      decryptField(stored, encryptionKey, kycDecryptOptions),
      validInput.documentNumber,
    );
  });

  it('rejects a new submission when one is already under review', async () => {
    const { service } = harness({ hasPending: true });

    await assert.rejects(
      () => service.submit('user-1', validInput),
      BadRequestException,
    );
  });

  it('rejects a submission for an already verified account', async () => {
    const { service } = harness({ tier: 'Verified' });

    await assert.rejects(
      () => service.submit('user-1', validInput),
      BadRequestException,
    );
  });
});
