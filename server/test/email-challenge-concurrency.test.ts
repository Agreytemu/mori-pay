import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { UnauthorizedException } from '@nestjs/common';

import { AuthService } from '../src/auth/auth.service.js';
import { hmacSha256 } from '../src/common/crypto.js';
import type { AppConfigService } from '../src/config/app-config.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const ACCESS_SECRET = 'test-access-secret-with-enough-length';
const EMAIL = 'user@example.com';
const CODE = '123456';
const PURPOSE = 'password_reset';

const config = {
  otp: { maxAttempts: 5, ttlSeconds: 300 },
  jwt: { accessSecret: ACCESS_SECRET },
  isProduction: false,
} as unknown as AppConfigService;

function buildService(claimed: number) {
  const events: string[] = [];
  const prisma = {
    emailChallenge: {
      findFirst: async () => ({
        id: 'challenge-1',
        userId: 'user-1',
        codeHash: hmacSha256(`${EMAIL}:${PURPOSE}:${CODE}`, ACCESS_SECRET),
        attempts: 0,
      }),
      update: async () => undefined,
    },
    user: {
      findFirst: async () => ({ id: 'user-1' }),
    },
    $transaction: async (cb: (tx: unknown) => Promise<void>) =>
      cb({
        emailChallenge: {
          updateMany: async () => {
            events.push('claim');
            return { count: claimed };
          },
        },
        user: {
          update: async () => {
            events.push('update-password');
          },
        },
        refreshToken: {
          updateMany: async () => {
            events.push('revoke-tokens');
          },
        },
      }),
  } as unknown as PrismaService;

  const service = new AuthService(
    prisma,
    config,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, events };
}

describe('AuthService one-time email challenge consumption', () => {
  it('applies the change when the challenge is claimed exactly once', async () => {
    const { service, events } = buildService(1);

    await service.resetPassword({
      email: EMAIL,
      code: CODE,
      password: 'New-Password-123',
    });

    assert.deepEqual(events, ['claim', 'update-password', 'revoke-tokens']);
  });

  it('refuses to redeem a code that a concurrent request already consumed', async () => {
    const { service, events } = buildService(0);

    await assert.rejects(
      () =>
        service.resetPassword({
          email: EMAIL,
          code: CODE,
          password: 'New-Password-123',
        }),
      UnauthorizedException,
    );
    assert.deepEqual(events, ['claim']);
  });

  it('rejects a wrong code without consuming the challenge', async () => {
    const { service } = buildService(1);

    await assert.rejects(
      () =>
        service.resetPassword({
          email: EMAIL,
          code: '000000',
          password: 'New-Password-123',
        }),
      UnauthorizedException,
    );
  });
});
