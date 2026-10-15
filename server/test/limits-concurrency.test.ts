import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BadRequestException } from '@nestjs/common';

import type { AppConfigService } from '../src/config/app-config.service.js';
import { LimitsService } from '../src/limits/limits.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const config = {
  limits: {
    standard: { dailyOutflow: 1_000_000n, perTransaction: 500_000n },
    verified: { dailyOutflow: 5_000_000n, perTransaction: 3_000_000n },
  },
} as unknown as AppConfigService;

function client(used: bigint) {
  const calls: string[] = [];
  return {
    calls,
    $executeRaw: async () => {
      calls.push('lock');
      return 1;
    },
    transaction: {
      aggregate: async () => {
        calls.push('aggregate');
        return { _sum: { amount: used, fee: 0n } };
      },
    },
  };
}

describe('LimitsService concurrency-safe enforcement', () => {
  it('takes the advisory lock before re-reading usage', async () => {
    const tx = client(0n);
    const service = new LimitsService({} as PrismaService, config);

    await service.assertWithinLimitsForUpdate(
      tx as never,
      'user-1',
      'Standard',
      100_000n,
    );

    assert.deepEqual(tx.calls, ['lock', 'aggregate']);
  });

  it('rejects a debit that would exceed the daily limit inside the transaction', async () => {
    const service = new LimitsService({} as PrismaService, config);
    const tx = client(950_000n);

    await assert.rejects(
      () =>
        service.assertWithinLimitsForUpdate(
          tx as never,
          'user-1',
          'Standard',
          100_000n,
        ),
      BadRequestException,
    );
  });

  it('rejects a debit above the per-transaction limit before locking', async () => {
    const service = new LimitsService({} as PrismaService, config);
    const tx = client(0n);

    await assert.rejects(
      () =>
        service.assertWithinLimitsForUpdate(
          tx as never,
          'user-1',
          'Standard',
          600_000n,
        ),
      BadRequestException,
    );
    assert.deepEqual(tx.calls, []);
  });
});
