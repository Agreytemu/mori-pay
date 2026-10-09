import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { InsufficientFundsError, InvalidLedgerLegError, UnbalancedLedgerError } from '../src/common/errors.js';
import { LedgerService } from '../src/ledger/ledger.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * These cases are validated before any database access, so a stub client is
 * enough to exercise the engine's guard clauses.
 */
const service = new LedgerService({} as PrismaService);

describe('LedgerService validation', () => {
  it('rejects postings with fewer than two legs', async () => {
    await assert.rejects(
      () =>
        service.post({
          reference: 'ref',
          legs: [{ ledgerAccountId: 'a', direction: 'credit', amount: 100n }],
        }),
      InvalidLedgerLegError,
    );
  });

  it('rejects non-positive leg amounts', async () => {
    await assert.rejects(
      () =>
        service.post({
          reference: 'ref',
          legs: [
            { ledgerAccountId: 'a', direction: 'credit', amount: 0n },
            { ledgerAccountId: 'b', direction: 'debit', amount: 0n },
          ],
        }),
      InvalidLedgerLegError,
    );
  });

  it('rejects unbalanced postings', async () => {
    await assert.rejects(
      () =>
        service.post({
          reference: 'ref',
          legs: [
            { ledgerAccountId: 'a', direction: 'credit', amount: 100n },
            { ledgerAccountId: 'b', direction: 'debit', amount: 90n },
          ],
        }),
      UnbalancedLedgerError,
    );
  });

  it('exposes a typed insufficient-funds error', () => {
    assert.equal(new InsufficientFundsError().code, 'INSUFFICIENT_FUNDS');
  });
});
