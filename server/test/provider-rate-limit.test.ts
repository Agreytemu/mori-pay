import 'reflect-metadata';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TopUpsController } from '../src/topups/topups.controller.js';
import { WithdrawalsController } from '../src/withdrawals/withdrawals.controller.js';

const PAYMENT_RATE_LIMIT = 60;
const PAYMENT_RATE_WINDOW_MS = 60_000;

function assertProviderPaymentThrottle(handler: object): void {
  assert.equal(
    Reflect.getMetadata('THROTTLER:LIMITdefault', handler),
    PAYMENT_RATE_LIMIT,
  );
  assert.equal(
    Reflect.getMetadata('THROTTLER:TTLdefault', handler),
    PAYMENT_RATE_WINDOW_MS,
  );
}

describe('Abliner payment endpoint rate limits', () => {
  it('limits mobile and card deposits to the provider payment rate', () => {
    assertProviderPaymentThrottle(TopUpsController.prototype.mobileMoney);
    assertProviderPaymentThrottle(TopUpsController.prototype.card);
  });

  it('limits withdrawals to the provider payment rate', () => {
    assertProviderPaymentThrottle(WithdrawalsController.prototype.create);
  });
});
