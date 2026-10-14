import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AblinerClient } from '../src/abliner/abliner.client.js';
import type { AuthService } from '../src/auth/auth.service.js';
import type { FeesService } from '../src/payments/fees.service.js';
import type { LimitsService } from '../src/limits/limits.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { SettlementService } from '../src/settlement/settlement.service.js';
import { WithdrawalsService } from '../src/withdrawals/withdrawals.service.js';
import type { WalletService } from '../src/wallet/wallet.service.js';

function makeService(): WithdrawalsService {
  return new WithdrawalsService(
    {} as PrismaService,
    {} as WalletService,
    {
      resolveFeeDetail: async () => ({
        fee: 250n,
        flat: 0n,
        percentage: 0.025,
        ruleId: 'mobile-withdrawal-fee',
      }),
    } as unknown as FeesService,
    {} as AuthService,
    {} as AblinerClient,
    {} as SettlementService,
    {} as LimitsService,
  );
}

describe('withdrawal customer fee', () => {
  it('uses the configured customer fee without consulting provider costs', async () => {
    assert.equal(
      (await makeService().resolveFeeDetail(10_000n)).fee,
      250n,
    );
    assert.deepEqual(await makeService().resolveFeeDetail(10_000n),
      {
        fee: 250n,
        flat: 0n,
        percentage: 0.025,
        ruleId: 'mobile-withdrawal-fee',
      },
    );
  });
});
