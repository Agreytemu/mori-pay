import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BadRequestException } from '@nestjs/common';

import {
  DEFAULT_TIER_LIMITS,
  resolveTierLimits,
} from '../src/limits/limits.config.js';
import { LimitsService } from '../src/limits/limits.service.js';

function makeService(usage: bigint): LimitsService {
  const prisma = {
    transaction: {
      aggregate: async () => ({ _sum: { amount: usage } }),
    },
  };
  const config = {
    limits: {
      standard: DEFAULT_TIER_LIMITS.Standard,
      verified: DEFAULT_TIER_LIMITS.Verified,
    },
  };
  return new LimitsService(prisma as never, config as never);
}

describe('limits config', () => {
  it('falls back to the standard tier for unknown tiers', () => {
    assert.deepEqual(resolveTierLimits('tier1'), DEFAULT_TIER_LIMITS.Standard);
    assert.deepEqual(resolveTierLimits('Verified'), DEFAULT_TIER_LIMITS.Verified);
    assert.deepEqual(resolveTierLimits('Standard'), DEFAULT_TIER_LIMITS.Standard);
  });
});

describe('limits service', () => {
  it('reports the tier limit and rolling usage', async () => {
    const summary = await makeService(250_000n).getSummary('usr_1', 'Standard');
    assert.equal(summary.dailyLimit, DEFAULT_TIER_LIMITS.Standard.dailyOutflow);
    assert.equal(summary.dailyUsed, 250_000n);
  });

  it('rejects amounts above the per-transaction limit', async () => {
    const service = makeService(0n);
    await assert.rejects(
      () => service.assertWithinLimits('usr_1', 'Standard', 600_000n),
      BadRequestException,
    );
  });

  it('rejects amounts that would breach the daily ceiling', async () => {
    const service = makeService(DEFAULT_TIER_LIMITS.Standard.dailyOutflow - 100n);
    await assert.rejects(
      () => service.assertWithinLimits('usr_1', 'Standard', 200n),
      BadRequestException,
    );
  });

  it('allows amounts within both limits', async () => {
    const service = makeService(100_000n);
    await assert.doesNotReject(() =>
      service.assertWithinLimits('usr_1', 'Standard', 100_000n),
    );
  });
});
