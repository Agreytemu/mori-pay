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

  it('keeps internal wallet transfers and merchant payments free despite stale rules', async () => {
    let ruleLookups = 0;
    const service = new FeesService({
      feeRule: {
        findFirst: async () => {
          ruleLookups += 1;
          return {
            id: 'stale-fee',
            flat: 100n,
            percentage: 0.1,
          };
        },
      },
    } as never);

    for (const type of ['send', 'payment']) {
      assert.deepEqual(
        await service.resolveFeeDetail({
          type,
          channel: 'wallet',
          amount: 10_000n,
        }),
        { fee: 0n, flat: 0n, percentage: 0, ruleId: null },
      );
    }
    assert.equal(ruleLookups, 0);
  });

  it('rounds percentage fees to the nearest TZS with half TZS rounded up', async () => {
    const service = new FeesService({
      feeRule: {
        findFirst: async () => ({
          id: 'half-shilling-fee',
          flat: 0n,
          percentage: 0.05,
        }),
      },
    } as never);

    assert.equal(
      (
        await service.resolveFeeDetail({
          type: 'deposit',
          channel: 'mobileMoney',
          amount: 10n,
        })
      ).fee,
      1n,
    );
  });

  it('rejects an invalid stored fee percentage instead of returning a misleading quote', async () => {
    const service = new FeesService({
      feeRule: {
        findFirst: async () => ({
          id: 'invalid-fee',
          flat: 0n,
          percentage: Number.NaN,
        }),
      },
    } as never);

    await assert.rejects(
      () =>
        service.resolveFeeDetail({
          type: 'deposit',
          channel: 'card',
          amount: 10_000n,
        }),
      /Invalid fee rule configuration/,
    );
  });
});
