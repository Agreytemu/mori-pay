import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TRANSACTION_STATUS,
  assertTransition,
  canTransition,
  isTerminalStatus,
} from '../src/payments/transaction-status.js';

describe('transaction state machine', () => {
  it('allows the documented forward transitions', () => {
    assert.equal(canTransition('pending', 'processing'), true);
    assert.equal(canTransition('pending', 'completed'), true);
    assert.equal(canTransition('pending', 'failed'), true);
    assert.equal(canTransition('processing', 'completed'), true);
    assert.equal(canTransition('processing', 'failed'), true);
  });

  it('rejects transitions out of terminal states', () => {
    assert.equal(canTransition('completed', 'failed'), false);
    assert.equal(canTransition('failed', 'completed'), false);
    assert.equal(canTransition('cancelled', 'pending'), false);
  });

  it('rejects backwards and unknown transitions', () => {
    assert.equal(canTransition('processing', 'pending'), false);
    assert.equal(canTransition('completed', 'completed'), false);
    assert.equal(canTransition('bogus', 'completed'), false);
  });

  it('identifies terminal states', () => {
    assert.equal(isTerminalStatus(TRANSACTION_STATUS.completed), true);
    assert.equal(isTerminalStatus(TRANSACTION_STATUS.failed), true);
    assert.equal(isTerminalStatus(TRANSACTION_STATUS.cancelled), true);
    assert.equal(isTerminalStatus(TRANSACTION_STATUS.pending), false);
    assert.equal(isTerminalStatus(TRANSACTION_STATUS.processing), false);
  });

  it('throws on an invalid transition', () => {
    assert.throws(() => assertTransition('completed', 'pending'));
    assert.doesNotThrow(() => assertTransition('pending', 'completed'));
  });
});
