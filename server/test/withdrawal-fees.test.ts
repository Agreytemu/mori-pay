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

function makeService(providerFee: number | Error): WithdrawalsService {
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
    {
      previewWithdrawal: async () => {
        if (providerFee instanceof Error) throw providerFee;
        return {
          amount_tzs: 10_000,
          fee_tzs: providerFee,
          total_debited_tzs: 10_000 + providerFee,
        };
      },
    } as unknown as AblinerClient,
    {} as SettlementService,
    {} as LimitsService,
  );
}

describe('withdrawal fee quotes', () => {
  it('uses the higher configured or provider fee', async () => {
    assert.equal(
      (await makeService(400).resolveFeeDetail(10_000n)).fee,
      400n,
    );
    assert.deepEqual(
      await makeService(200).resolveFeeDetail(10_000n),
      {
        fee: 250n,
        flat: 0n,
        percentage: 0.025,
        ruleId: 'mobile-withdrawal-fee',
      },
    );
  });

  it('does not issue a quote when the provider fee is unavailable', async () => {
    await assert.rejects(
      () => makeService(new Error('provider unavailable')).resolveFeeDetail(10_000n),
      /provider unavailable/,
    );
  });
});
