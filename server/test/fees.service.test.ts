import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FeesService } from '../src/payments/fees.service.js';

describe('FeesService', () => {
  it('returns the configured flat and percentage fee', async () => {
    const service = new FeesService({
      feeRule: {
        findFirst: async () => ({
          id: 'card-fee',
          flat: 100n,
          percentage: 0.045,
        }),
      },
    } as never);

    assert.deepEqual(
      await service.resolveFeeDetail({
        type: 'deposit',
        channel: 'card',
        amount: 10_000n,
      }),
      {
        fee: 550n,
        flat: 100n,
        percentage: 0.045,
        ruleId: 'card-fee',
      },
    );
  });

  it('returns a zero fee when no active rule matches', async () => {
    const service = new FeesService({
      feeRule: { findFirst: async () => null },
    } as never);

    assert.equal(
      await service.resolveFee({
        type: 'send',
        channel: 'wallet',
        amount: 10_000n,
      }),
      0n,
    );
  });
});
