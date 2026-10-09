import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AppConfigService } from '../src/config/app-config.service.js';
import { TokenService } from '../src/auth/token.service.js';

const fakeConfig = {
  jwt: {
    accessSecret: 'access-secret-'.padEnd(32, 'x'),
    refreshSecret: 'refresh-secret-'.padEnd(32, 'y'),
    accessTtl: '15m',
    refreshTtl: '30d',
  },
} as unknown as AppConfigService;

const tokens = new TokenService(fakeConfig);

describe('TokenService', () => {
  it('signs and verifies access tokens', () => {
    const { token, expiresIn } = tokens.createAccessToken('user_1', 'session_1');
    assert.equal(expiresIn, 15 * 60);

    const payload = tokens.verifyAccessToken(token);
    assert.equal(payload.sub, 'user_1');
    assert.equal(payload.sid, 'session_1');
    assert.equal(payload.typ, 'access');
  });

  it('rejects tampered tokens', () => {
    const { token } = tokens.createAccessToken('user_1', 'session_1');
    assert.throws(() => tokens.verifyAccessToken(`${token}tampered`));
  });

  it('separates setup tokens from access tokens', () => {
    const setup = tokens.createSetupToken('255700000001');
    assert.equal(tokens.verifySetupToken(setup.token).sub, '255700000001');
    assert.throws(() => tokens.verifyAccessToken(setup.token));
  });

  it('hashes refresh tokens deterministically', () => {
    const refresh = tokens.createRefreshToken();
    assert.equal(tokens.hashRefreshToken(refresh.token), refresh.tokenHash);
    assert.notEqual(refresh.token, refresh.tokenHash);
    assert.ok(refresh.expiresAt.getTime() > Date.now());
  });
});
