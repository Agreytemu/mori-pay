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
    assert.equal(canTransition('deposit', 'pending', 'completed'), true);
    assert.equal(canTransition('deposit', 'pending', 'failed'), true);
    assert.equal(canTransition('withdrawal', 'processing', 'completed'), true);
    assert.equal(canTransition('withdrawal', 'processing', 'failed'), true);
  });

  it('rejects transitions that do not belong to the flow', () => {
    assert.equal(canTransition('deposit', 'pending', 'processing'), false);
    assert.equal(canTransition('withdrawal', 'pending', 'completed'), false);
    assert.equal(canTransition('send', 'completed', 'failed'), false);
  });

  it('rejects backwards and unknown transitions', () => {
    assert.equal(canTransition('deposit', 'failed', 'completed'), false);
    assert.equal(canTransition('withdrawal', 'completed', 'completed'), false);
    assert.equal(canTransition('bogus', 'pending', 'completed'), false);
  });

  it('identifies terminal states', () => {
    assert.equal(isTerminalStatus(TRANSACTION_STATUS.completed), true);
    assert.equal(isTerminalStatus(TRANSACTION_STATUS.failed), true);
    assert.equal(isTerminalStatus(TRANSACTION_STATUS.cancelled), true);
    assert.equal(isTerminalStatus(TRANSACTION_STATUS.pending), false);
    assert.equal(isTerminalStatus(TRANSACTION_STATUS.processing), false);
  });

  it('throws on an invalid transition', () => {
    assert.throws(() => assertTransition('deposit', 'completed', 'pending'));
    assert.doesNotThrow(() => assertTransition('deposit', 'pending', 'completed'));
  });
});
